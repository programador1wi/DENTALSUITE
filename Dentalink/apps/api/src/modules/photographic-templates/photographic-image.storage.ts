import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";

const STORAGE_ROOT = resolve(process.cwd(), "storage", "patient-files");
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);

export type StoredPhotographicFile = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  absolutePath: string;
};

export type PreparedPhotographicImage = {
  checksum: string;
  mimeType: string;
  width: number;
  height: number;
  original: StoredPhotographicFile;
  preview: StoredPhotographicFile;
  thumbnail: StoredPhotographicFile;
};

export type PhotographicTransformations = {
  rotation: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  zoom: number;
  brightness: number;
  contrast: number;
};

@Injectable()
export class PhotographicImageStorage {
  async prepareAndStore(input: {
    organizationId: string;
    patientId: string;
    originalName: string;
    declaredMimeType?: string;
    buffer?: Buffer;
  }): Promise<PreparedPhotographicImage> {
    if (!input.buffer?.length) throw new BadRequestException("Image file is required");
    if (input.buffer.length > MAX_IMAGE_SIZE) throw new BadRequestException("Image exceeds 25 MB");

    const metadata = await sharp(input.buffer, { failOn: "warning" })
      .metadata()
      .catch(() => {
        throw new BadRequestException("Image is corrupt or its real format is not supported");
      });
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new BadRequestException("Only JPEG, PNG, WebP and HEIC images are supported");
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 320 || height < 240 || width > 12000 || height > 12000) {
      throw new BadRequestException("Image dimensions must be between 320x240 and 12000x12000 pixels");
    }

    const mimeType = this.mimeForFormat(metadata.format);
    if (input.declaredMimeType?.startsWith("image/") === false) {
      throw new BadRequestException("Declared file type is not an image");
    }
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    const normalized = sharp(input.buffer, { failOn: "warning" }).rotate();
    const previewBuffer = await normalized
      .clone()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const thumbnailBuffer = await normalized
      .clone()
      .resize({ width: 520, height: 420, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const original = await this.writeVariant({
      organizationId: input.organizationId,
      patientId: input.patientId,
      buffer: input.buffer,
      extension: this.extensionForFormat(metadata.format),
      originalName: input.originalName,
      mimeType,
      category: "ORTHODONTIC_PHOTO_ORIGINAL"
    });
    const preview = await this.writeVariant({
      organizationId: input.organizationId,
      patientId: input.patientId,
      buffer: previewBuffer,
      extension: ".jpg",
      originalName: `${this.baseName(input.originalName)}-preview.jpg`,
      mimeType: "image/jpeg",
      category: "ORTHODONTIC_PHOTO_PREVIEW"
    });
    const thumbnail = await this.writeVariant({
      organizationId: input.organizationId,
      patientId: input.patientId,
      buffer: thumbnailBuffer,
      extension: ".jpg",
      originalName: `${this.baseName(input.originalName)}-thumbnail.jpg`,
      mimeType: "image/jpeg",
      category: "ORTHODONTIC_PHOTO_THUMBNAIL"
    });

    return { checksum, mimeType, width, height, original, preview, thumbnail };
  }

  async storeEdited(input: {
    organizationId: string;
    patientId: string;
    originalFileName: string;
    originalName: string;
    transformations: PhotographicTransformations;
  }) {
    const directory = this.directory(input.organizationId, input.patientId);
    const sourcePath = resolve(directory, input.originalFileName);
    if (!this.isInside(directory, sourcePath)) throw new BadRequestException("Invalid image path");
    const source = await readFile(sourcePath).catch(() => {
      throw new NotFoundException("Original clinical image is not available");
    });

    const rotated = await sharp(source, { failOn: "warning" })
      .rotate(input.transformations.rotation)
      .toBuffer({ resolveWithObject: true });
    let pipeline = sharp(rotated.data, { failOn: "warning" });
    const width = rotated.info.width;
    const height = rotated.info.height;
    const zoom = Math.max(1, input.transformations.zoom);
    const requestedWidth = input.transformations.cropWidth / zoom;
    const requestedHeight = input.transformations.cropHeight / zoom;
    const left = Math.min(width - 1, Math.max(0, Math.round(input.transformations.cropX * width)));
    const top = Math.min(height - 1, Math.max(0, Math.round(input.transformations.cropY * height)));
    const cropWidth = Math.max(1, Math.min(width - left, Math.round(requestedWidth * width)));
    const cropHeight = Math.max(1, Math.min(height - top, Math.round(requestedHeight * height)));
    pipeline = pipeline
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .modulate({ brightness: input.transformations.brightness })
      .linear(input.transformations.contrast, 128 * (1 - input.transformations.contrast));
    const editedBuffer = await pipeline.jpeg({ quality: 92 }).toBuffer();

    return this.writeVariant({
      organizationId: input.organizationId,
      patientId: input.patientId,
      buffer: editedBuffer,
      extension: ".jpg",
      originalName: `${this.baseName(input.originalName)}-edited.jpg`,
      mimeType: "image/jpeg",
      category: "ORTHODONTIC_PHOTO_EDITED"
    });
  }

  async cleanup(files: StoredPhotographicFile[]) {
    await Promise.all(files.map((file) => unlink(file.absolutePath).catch(() => undefined)));
  }

  async open(organizationId: string, patientId: string, fileName: string) {
    const directory = this.directory(organizationId, patientId);
    const absolutePath = resolve(directory, fileName);
    if (!this.isInside(directory, absolutePath)) throw new BadRequestException("Invalid image path");
    await stat(absolutePath).catch(() => {
      throw new NotFoundException("Clinical image is not available");
    });
    return createReadStream(absolutePath);
  }

  private async writeVariant(input: {
    organizationId: string;
    patientId: string;
    buffer: Buffer;
    extension: string;
    originalName: string;
    mimeType: string;
    category: string;
  }): Promise<StoredPhotographicFile> {
    const id = randomUUID();
    const fileName = `${Date.now()}-${id}${input.extension}`;
    const directory = this.directory(input.organizationId, input.patientId);
    await mkdir(directory, { recursive: true });
    const absolutePath = join(directory, fileName);
    await writeFile(absolutePath, input.buffer, { flag: "wx" });
    return {
      id,
      fileName,
      originalName: this.safeOriginalName(input.originalName),
      mimeType: input.mimeType,
      size: input.buffer.length,
      url: `/photographic-files/${id}/content`,
      category: input.category,
      absolutePath
    };
  }

  private directory(organizationId: string, patientId: string) {
    return resolve(STORAGE_ROOT, organizationId, patientId);
  }

  private isInside(parentPath: string, childPath: string) {
    const segment = relative(parentPath, childPath);
    return Boolean(segment) && !segment.startsWith("..") && !isAbsolute(segment);
  }

  private extensionForFormat(format: string) {
    if (format === "jpeg") return ".jpg";
    if (format === "heif") return ".heic";
    return `.${format}`;
  }

  private mimeForFormat(format: string) {
    if (format === "jpeg") return "image/jpeg";
    if (format === "heif") return "image/heic";
    return `image/${format}`;
  }

  private baseName(value: string) {
    return this.safeOriginalName(value).replace(/\.[^.]+$/, "") || "clinical-photo";
  }

  private safeOriginalName(value: string) {
    return (value || "clinical-photo").replace(/[\r\n"\\/]/g, "_").slice(0, 240);
  }
}
