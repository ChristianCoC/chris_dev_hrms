import { query } from "../config/db.js";

export const createClaim = async (req, res) => {
  const { title, description, priority = "normal" } = req.body;
  const filed_by_id = req.user.id;

  if (!title || !description) {
    return res.status(400).json({
      status: "error",
      message: "Faltan campos requeridos: title y description.",
    });
  }

  try {
    const result = await query(
      `INSERT INTO claims (title, description, priority, filed_by_id) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, title, description, priority, filed_by_id, created_at;`,
      [title, description, priority, filed_by_id],
    );

    return res.status(201).json({
      status: "success",
      message: "Reclamo creado correctamente.",
      data: {
        claim: result.rows[0],
      },
    });
  } catch (error) {
    console.error("❌ Error al crear reclamo:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al crear el reclamo.",
      error: error.message,
    });
  }
};

export const resolveClaim = async (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes } = req.body;
  const assigned_to_id = req.user.id;

  const validStatuses = ["approved", "rejected", "in_progress"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      status: "error",
      message: `El estado es inválido y debe ser uno de los siguientes valores: ${validStatuses.join(", ")}.`,
    });
  }

  try {
    const checkClaim = await query(
      "SELECT id, status FROM claims WHERE id = $1",
      [id],
    );
    if (checkClaim.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Reclamo no encontrado.",
      });
    }

    const result = await query(
      `UPDATE claims 
        SET status = $1, 
        resolution_notes = $2, 
        assigned_to_id = $3, 
        resolved_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, title, status, resolution_notes, resolved_at, assigned_to_id;`,
      [status, resolution_notes, assigned_to_id, id],
    );

    return res.status(200).json({
      status: "success",
      message: `Reclamo resuelto correctamente a estado: ${status}.`,
      data: {
        claim: result.rows[0],
      },
    });
  } catch (error) {
    console.error("❌ Error al resolver reclamo:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al resolver el reclamo.",
      error: error.message,
    });
  }
};

export const getClaims = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role_id;

  try {
    let queryText = "";
    let queryParams = [];

    if (userRole === 1 || userRole === 2) {
      queryText = `
        SELECT c.*,
        u1.first_name AS filed_by_name, u1.last_name AS filed_by_last_name,
        u2.first_name AS resolved_by_name
        FROM claims c
        JOIN users u1 ON c.filed_by_id = u1.id
        LEFT JOIN users u2 ON c.assigned_to_id = u2.id
        ORDER BY c.created_at DESC
        `;
    } else {
      queryText = `
        SELECT c.*,
        u2.first_name AS resolved_by_name
        FROM claims c
        LEFT JOIN users u2 ON c.assigned_to_id = u2.id
        WHERE c.filed_by_id = $1
        ORDER BY c.created_at DESC
        `;
      queryParams = [userId];
    }

    const result = await query(queryText, queryParams);
    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        claims: result.rows,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener reclamos:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener los reclamos.",
      error: error.message,
    });
  }
};
