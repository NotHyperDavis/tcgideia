const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// Criar avaliação
router.post("/", requireAuth, async (req, res) => {
    const {
        order_id,
        reviewed_user_id,
        rating,
        comment
    } = req.body;

    if (
        !order_id ||
        !reviewed_user_id ||
        !rating
    ) {
        return res.status(400).json({
            error: "Dados da avaliação incompletos."
        });
    }

    if (
        !Number.isInteger(Number(rating)) ||
        Number(rating) < 1 ||
        Number(rating) > 5
    ) {
        return res.status(400).json({
            error: "A avaliação deve ser entre 1 e 5."
        });
    }

    try {
        const orderResult =
            await pool.query(
                `
                SELECT
                    id,
                    buyer_id,
                    seller_id,
                    status
                FROM orders
                WHERE id = $1
                `,
                [order_id]
            );

        if (
            orderResult.rows.length === 0
        ) {
            return res.status(404).json({
                error: "Encomenda não encontrada."
            });
        }

        const order =
            orderResult.rows[0];

        /*
        Só se pode avaliar depois
        da encomenda estar concluída.
        */
        if (
            order.status !== "completed"
        ) {
            return res.status(400).json({
                error:
                    "Só podes avaliar depois de a encomenda estar concluída."
            });
        }

        /*
        O utilizador tem de fazer
        parte da encomenda.
        */
        const isBuyer =
            order.buyer_id === req.user.id;

        const isSeller =
            order.seller_id === req.user.id;

        if (!isBuyer && !isSeller) {
            return res.status(403).json({
                error:
                    "Não tens acesso a esta encomenda."
            });
        }

        /*
        Só podes avaliar a outra pessoa.
        */
        if (
            Number(reviewed_user_id) ===
            Number(req.user.id)
        ) {
            return res.status(400).json({
                error:
                    "Não podes avaliar-te a ti próprio."
            });
        }

        /*
        Garantir que a pessoa avaliada
        é realmente o outro interveniente.
        */
        const validTarget =
            isBuyer
                ? order.seller_id
                : order.buyer_id;

        if (
            Number(reviewed_user_id) !==
            Number(validTarget)
        ) {
            return res.status(400).json({
                error:
                    "Utilizador avaliado inválido."
            });
        }

        const result =
            await pool.query(
                `
                INSERT INTO reviews
                (
                    order_id,
                    reviewer_id,
                    reviewed_user_id,
                    rating,
                    comment
                )
                VALUES ($1, $2, $3, $4, $5)

                RETURNING *
                `,
                [
                    order_id,
                    req.user.id,
                    reviewed_user_id,
                    rating,
                    comment || null
                ]
            );

        res.status(201).json(
            result.rows[0]
        );

    } catch (error) {
        if (
            error.code === "23505"
        ) {
            return res.status(400).json({
                error:
                    "Já fizeste uma avaliação para esta encomenda."
            });
        }

        console.error(error);

        res.status(500).json({
            error:
                "Erro ao criar avaliação."
        });
    }
});

// Listar todas as avaliações de um utilizador (recebidas e feitas) para a página de perfil
router.get("/user/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const reviewsResult =
            await pool.query(
                `
                SELECT DISTINCT
                    reviews.*,
                    u_reviewer.name AS reviewer_name,
                    u_reviewed.name AS reviewed_user_name
                FROM reviews
                JOIN users u_reviewer ON u_reviewer.id = reviews.reviewer_id
                JOIN users u_reviewed ON u_reviewed.id = reviews.reviewed_user_id
                WHERE reviews.reviewed_user_id = $1 OR reviews.reviewer_id = $1
                ORDER BY reviews.created_at DESC
                `,
                [userId]
            );

        const averageResult =
            await pool.query(
                `
                SELECT
                    ROUND(AVG(rating)::numeric, 1) AS average,
                    COUNT(*)::int AS total
                FROM reviews
                WHERE reviewed_user_id = $1
                `,
                [userId]
            );

        res.json({
            reviews: reviewsResult.rows,
            average: averageResult.rows[0].average || 0,
            total: averageResult.rows[0].total || 0
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error:
                "Erro ao obter avaliações."
        });
    }
});

module.exports = router;