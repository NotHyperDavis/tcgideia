const express = require("express");
const multer = require("multer");
const cloudinary = require("../utils/cloudinary");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Guarda o ficheiro em memória (não em disco) — depois é enviado logo para o Cloudinary.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, chega bem para fotos de cartas
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Só são permitidas imagens."));
        }
        cb(null, true);
    },
});

// POST /upload — recebe um ficheiro (campo "image"), devolve o URL público
router.post("/", requireAuth, (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || "Erro ao processar a imagem." });
        }
        next();
    });
}, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: "tcgideia", resource_type: "image" },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        res.json({ url: result.secure_url });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao enviar a imagem." });
    }
});

module.exports = router;