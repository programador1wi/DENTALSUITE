import { validateUploadedFile } from "./file-type-validation";

describe("validateUploadedFile", () => {
  it.each([
    ["photo.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ["scan.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["note.txt", "text/plain", Buffer.from("Nota clínica", "utf8")],
    ["study.dcm", "application/dicom", Buffer.concat([Buffer.alloc(128), Buffer.from("DICM")])]
  ])("accepts matching extension, MIME and signature for %s", (originalname, mimetype, buffer) => {
    expect(validateUploadedFile({ originalname, mimetype, size: buffer.length, buffer })).toEqual(
      expect.objectContaining({ ok: true })
    );
  });

  it("rejects executable content disguised as a PDF", () => {
    const buffer = Buffer.from("MZ executable", "ascii");
    expect(
      validateUploadedFile({ originalname: "consent.pdf", mimetype: "application/pdf", size: buffer.length, buffer })
    ).toEqual(expect.objectContaining({ ok: false, code: "SIGNATURE_MISMATCH" }));
  });

  it("rejects a valid signature when declared MIME does not match the extension", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    expect(
      validateUploadedFile({ originalname: "photo.jpg", mimetype: "application/pdf", size: buffer.length, buffer })
    ).toEqual(expect.objectContaining({ ok: false, code: "MIME_MISMATCH" }));
  });

  it("rejects a ZIP renamed as DOCX when it lacks the OOXML document structure", () => {
    const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("arbitrary.zip")]);
    expect(
      validateUploadedFile({
        originalname: "document.docx",
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: buffer.length,
        buffer
      })
    ).toEqual(expect.objectContaining({ ok: false, code: "SIGNATURE_MISMATCH" }));
  });

  it("rejects inconsistent metadata length", () => {
    const buffer = Buffer.from("plain", "utf8");
    expect(validateUploadedFile({ originalname: "note.txt", mimetype: "text/plain", size: 99, buffer })).toEqual(
      expect.objectContaining({ ok: false, code: "SIZE_MISMATCH" })
    );
  });
});
