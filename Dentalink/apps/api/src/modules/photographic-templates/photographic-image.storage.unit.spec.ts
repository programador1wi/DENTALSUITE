import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import { PhotographicImageStorage } from "./photographic-image.storage";

describe("PhotographicImageStorage", () => {
  const storage = new PhotographicImageStorage();

  it("rejects corrupt files even when the declared MIME says image/jpeg", async () => {
    await expect(
      storage.prepareAndStore({
        organizationId: "test-org",
        patientId: "test-patient",
        originalName: "corrupt.jpg",
        declaredMimeType: "image/jpeg",
        buffer: Buffer.from("not-an-image")
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("validates minimum clinical image dimensions", async () => {
    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } })
      .jpeg()
      .toBuffer();
    await expect(
      storage.prepareAndStore({
        organizationId: "test-org",
        patientId: "test-patient",
        originalName: "tiny.jpg",
        declaredMimeType: "image/jpeg",
        buffer: tiny
      })
    ).rejects.toThrow("Image dimensions");
  });

  it("keeps an original and creates optimized preview, thumbnail and non-destructive edit", async () => {
    const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#2d91c8" } })
      .jpeg({ quality: 95 })
      .toBuffer();
    const prepared = await storage.prepareAndStore({
      organizationId: "test-org",
      patientId: "test-patient",
      originalName: "initial.jpg",
      declaredMimeType: "image/jpeg",
      buffer: source
    });
    const edited = await storage.storeEdited({
      organizationId: "test-org",
      patientId: "test-patient",
      originalFileName: prepared.original.fileName,
      originalName: prepared.original.originalName,
      transformations: {
        rotation: 90,
        cropX: 0,
        cropY: 0,
        cropWidth: 1,
        cropHeight: 1,
        zoom: 1,
        brightness: 1.1,
        contrast: 1.05
      }
    });

    expect(prepared.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.original.size).toBe(source.length);
    expect(prepared.preview.mimeType).toBe("image/jpeg");
    expect(prepared.thumbnail.size).toBeGreaterThan(0);
    expect(edited.category).toBe("ORTHODONTIC_PHOTO_EDITED");
    await storage.cleanup([prepared.original, prepared.preview, prepared.thumbnail, edited]);
  });

  it("decodes HEIF/HEIC-family input and produces browser-compatible JPEG derivatives", async () => {
    const heif = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#f2d6c9" } })
      .heif({ quality: 80, compression: "av1" })
      .toBuffer();
    const prepared = await storage.prepareAndStore({
      organizationId: "test-org",
      patientId: "test-patient",
      originalName: "mobile.heic",
      declaredMimeType: "image/heic",
      buffer: heif
    });

    expect(prepared.mimeType).toBe("image/heic");
    expect(prepared.preview.mimeType).toBe("image/jpeg");
    expect(prepared.thumbnail.mimeType).toBe("image/jpeg");
    await storage.cleanup([prepared.original, prepared.preview, prepared.thumbnail]);
  });
});
