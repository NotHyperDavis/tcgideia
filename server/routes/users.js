const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();


// GET /users/:id
// Perfil público
router.get("/:id", async (req, res) => {

    try {

        const userResult = await pool.query(
            `
            SELECT
                id,
                name,
                created_at
            FROM users
            WHERE id = $1
            `,
            [req.params.id]
        );
        const ratingResult = await pool.query(
            `
            SELECT
                ROUND(AVG(rating)::numeric, 2) AS average,
                COUNT(*) AS count
            FROM reviews
            WHERE reviewed_user_id = $1
            `,
            [req.params.id]
        );


        if (userResult.rows.length === 0) {

            return res.status(404).json({
                error: "Utilizador não encontrado."
            });

        }


        const user =
            userResult.rows[0];


        /*
        Anúncios ativos
        */

        const listingsResult =
            await pool.query(
                `
                SELECT *
                FROM listings
                WHERE user_id = $1
                AND status = 'active'
                ORDER BY created_at DESC
                `,
                [req.params.id]
            );


        /*
        Vendas concluídas
        */

        const salesResult =
            await pool.query(
                `
                SELECT COUNT(*) AS count
                FROM orders
                WHERE seller_id = $1
                AND status = 'completed'
                `,
                [req.params.id]
            );


        /*
        Compras concluídas
        */

        const purchasesResult =
            await pool.query(
                `
                SELECT COUNT(*) AS count
                FROM orders
                WHERE buyer_id = $1
                AND status = 'completed'
                `,
                [req.params.id]
            );


        res.json({

            ...user,

            stats: {

                active_listings:
                    listingsResult.rows.length,

                sales:
                    Number(
                        salesResult.rows[0].count
                    ),

                purchases:
                    Number(
                        purchasesResult.rows[0].count
                    ),

                rating: 
                    ratingResult.rows[0].count > 0
                        ? Number(
                            ratingResult.row[0].average
                        )
                        : null,

                review_count:
                        Number(
                            ratingResult.rows[0].count
                        )
            },

            active_listings:
                listingsResult.rows

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            error:
                "Erro ao obter perfil."

        });

    }

});

module.exports = router;