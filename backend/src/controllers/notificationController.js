import { query } from "../config/db.js";

export const getMyNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await query(
      `SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, c.title AS claim_title
        FROM notifications n
        LEFT JOIN claims c ON n.related_claim_id = c.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC`,
      [userId],
    );
    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        notifications: result.rows,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener notificaciones:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener las notificaciones.",
      error: error.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id, title, is_read`,
      [id, userId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Notificación no encontrada o no pertenece al usuario.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Notificación marcada como leída.",
      data: {
        notification: result.rows[0],
      },
    });
  } catch (error) {
    console.error("❌ Error al marcar notificación como leída:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al marcar la notificación como leída.",
      error: error.message,
    });
  }
};
