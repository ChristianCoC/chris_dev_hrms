import { query } from "../config/db.js";

export const getAllUsers = async (req, res) => {
  try {
    const result = await query(
      "SELECT id, email, first_name, last_name, role_id, created_at, updated_at FROM users",
    );
    return res.status(200).json({
      status: "success",
      results: result.rowCount,
      data: {
        users: result.rows,
      },
    });
  } catch (error) {
    console.error("❌ Error al obtener usuarios:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al obtener la lista de usuarios.",
      error: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user.id === id) {
    return res.status(400).json({
      status: "error",
      message: "Operación denegada. No puedes eliminar tu propio usuario.",
    });
  }

  try {
    const userChek = await query("SELECT id FROM users WHERE id = $1", [id]);

    if (userChek.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    await query("DELETE FROM users WHERE id = $1", [id]);

    return res.status(200).json({
      status: "success",
      message: "Usuario eliminado correctamente del sistema.",
    });
  } catch (error) {
    console.error("❌ Error al eliminar usuario:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al eliminar el usuario.",
      error: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, role_id } = req.body;
  const isUpdatingSelf = req.user.id === id;
  const isAuthorizedManager = [1, 2].includes(req.user.role_id);

  if (!isUpdatingSelf && !isAuthorizedManager) {
    return res.status(403).json({
      status: "error",
      message:
        "Acceso denegado. No tiene los permisos necesarios para actualizar este usuario.",
    });
  }

  const fieldsToUpdate = [];
  const valuesToUpdate = [];
  let queryIndex = 1;

  if (first_name) {
    fieldsToUpdate.push(`first_name = $${queryIndex++}`);
    valuesToUpdate.push(first_name);
  }

  if (last_name) {
    fieldsToUpdate.push(`last_name = $${queryIndex++}`);
    valuesToUpdate.push(last_name);
  }

  if (role_id) {
    if (!isAuthorizedManager) {
      return res.status(403).json({
        status: "error",
        message:
          "Acceso denegado. No tiene los permisos necesarios para actualizar el rol de este usuario.",
      });
    }
    fieldsToUpdate.push(`role_id = $${queryIndex++}`);
    valuesToUpdate.push(role_id);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "No se proporcionaron campos válidos para actualizar.",
    });
  }

  try {
    const updateQuery = `
            UPDATE users
            SET ${fieldsToUpdate.join(", ")}, updated_at = NOW()
            WHERE id = $${queryIndex}
            RETURNING id, email, first_name, last_name, role_id, updated_at;
        `;
    valuesToUpdate.push(id);

    const result = await query(updateQuery, valuesToUpdate);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Perfil de usuario actualizado correctamente.",
      data: {
        user: result.rows[0],
      },
    });
  } catch (error) {
    console.error("❌ Error al actualizar usuario:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Error interno al actualizar el perfil del usuario.",
      error: error.message,
    });
  }
};
