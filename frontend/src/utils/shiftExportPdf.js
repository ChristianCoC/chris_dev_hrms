import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TYPE_LABELS = {
  trabajo: 'Trabajo',
  franco: 'Franco',
  licencia: 'Licencia',
  feriado: 'Feriado',
};

/**
 * Exporta el horario semanal personal de un colaborador en formato PDF (Retrato / Portrait).
 */
export const exportPersonalShiftsPdf = ({ user, weekDays, weekLabel, shifts }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [37, 99, 235]; // Tailwind blue-600
  const darkTextColor = [30, 41, 59]; // slate-800
  const mutedTextColor = [100, 116, 139]; // slate-500

  // 1. Cabecera Corporativa
  doc.setFillColor(30, 41, 59); // slate-900
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HRMS — Grilla Semanal de Horarios', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Gestión Integral de Recursos Humanos', 14, 20);

  // 2. Información del Colaborador y Período
  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Datos del Colaborador', 14, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Colaborador';
  const docNumber = user?.document_number ? `DNI: ${user.document_number}` : 'DNI: N/A';
  const fileNumber = user?.file_number ? `Legajo: ${user.file_number}` : 'Legajo: N/A';
  const department = user?.department ? `Departamento: ${user.department}` : 'Departamento: General';

  doc.text(`Nombre: ${fullName}`, 14, 40);
  doc.text(`${docNumber}  |  ${fileNumber}`, 14, 45);
  doc.text(department, 14, 50);

  // Período a la derecha
  doc.setFont('helvetica', 'bold');
  doc.text('Período Semanal:', 130, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(weekLabel || 'Semana activa', 130, 45);

  // 3. Tabla Estructurada de los 7 Días
  const tableData = weekDays.map((day) => {
    // Buscar el turno correspondiente al día
    const shift = shifts.find((s) => {
      const sDate = typeof s.shift_date === 'string' ? s.shift_date.slice(0, 10) : '';
      return sDate === day.dateStr;
    });

    const dayCol = `${day.dayName}\n${day.dayNumber}/${day.monthNumber}`;
    const typeCol = shift ? (TYPE_LABELS[shift.shift_type] || shift.shift_type) : 'Sin asignar';
    let timeCol = '-';
    if (shift && shift.shift_type === 'trabajo') {
      const start = shift.start_time ? shift.start_time.slice(0, 5) : '';
      const end = shift.end_time ? shift.end_time.slice(0, 5) : '';
      timeCol = start && end ? `${start} – ${end} hs` : '-';
    } else if (shift && shift.shift_type === 'franco') {
      timeCol = 'Descanso';
    }

    const locationCol = shift?.location || '-';
    const notesCol = shift?.notes || '-';

    return [dayCol, typeCol, timeCol, locationCol, notesCol];
  });

  autoTable(doc, {
    startY: 56,
    head: [['Día / Fecha', 'Estado / Tipo', 'Horario Entrada–Salida', 'Ubicación / Puesto', 'Observaciones']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
    },
    styles: {
      fontSize: 8.5,
      textColor: darkTextColor,
      valign: 'middle',
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 40, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 42 },
      4: { halign: 'left' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
  });

  // 4. Pie de Página con Fecha de Emisión
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...mutedTextColor);
  const now = new Date();
  const emissionDate = `Documento emitido el ${now.toLocaleDateString('es-AR')} a las ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs — HRMS`;
  doc.text(emissionDate, 14, pageHeight - 10);

  // 5. Descargar archivo
  const lastNameClean = (user?.last_name || 'Colaborador').replace(/\s+/g, '_');
  const startDateStr = weekDays[0]?.dateStr || 'semana';
  const fileName = `Horario_Semanal_${lastNameClean}_${startDateStr}.pdf`;
  doc.save(fileName);
};

/**
 * Exporta la matriz completa de planificación de turnos de la semana en formato PDF (Apaisado / Landscape).
 */
export const exportMatrixShiftsPdf = ({ weekDays, weekLabel, employees, shiftsMap }) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [37, 99, 235]; // blue-600
  const darkTextColor = [30, 41, 59];
  const mutedTextColor = [100, 116, 139];

  // 1. Cabecera Corporativa Landscape (Ancho 297mm)
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 297, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('HRMS — Matriz Semanal de Planificación de Turnos', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Período: ${weekLabel || ''}  |  Colaboradores listados: ${employees.length}`, 14, 18);

  const now = new Date();
  const emissionRight = `Emitido: ${now.toLocaleDateString('es-AR')} ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`;
  doc.text(emissionRight, 225, 18);

  // 2. Construir cabeceras de columnas (Colaborador + 7 Días)
  const headers = [
    'Colaborador / Legajo',
    ...weekDays.map((d) => `${d.dayName}\n${d.dayNumber}/${d.monthNumber}`),
  ];

  // 3. Filas de datos
  const tableData = employees.map((emp) => {
    const fileNum = emp.file_number ? `Leg. ${emp.file_number}` : '';
    const dept = emp.department ? `(${emp.department})` : '';
    const empLabel = `${emp.first_name} ${emp.last_name}\n${[fileNum, dept].filter(Boolean).join(' ')}`.trim();

    const row = [empLabel];

    for (const day of weekDays) {
      const shift = shiftsMap.get(`${emp.id}_${day.dateStr}`);
      if (!shift) {
        row.push('—');
      } else {
        const typeName = TYPE_LABELS[shift.shift_type] || shift.shift_type;
        if (shift.shift_type === 'trabajo') {
          const start = shift.start_time ? shift.start_time.slice(0, 5) : '';
          const end = shift.end_time ? shift.end_time.slice(0, 5) : '';
          const time = start && end ? `${start} - ${end}` : '';
          const loc = shift.location ? `\n📍 ${shift.location}` : '';
          row.push(`${typeName}\n${time}${loc}`);
        } else {
          row.push(typeName);
        }
      }
    }

    return row;
  });

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    styles: {
      fontSize: 7.5,
      textColor: darkTextColor,
      valign: 'middle',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 45 },
      1: { halign: 'center', cellWidth: 34 },
      2: { halign: 'center', cellWidth: 34 },
      3: { halign: 'center', cellWidth: 34 },
      4: { halign: 'center', cellWidth: 34 },
      5: { halign: 'center', cellWidth: 34 },
      6: { halign: 'center', cellWidth: 34 },
      7: { halign: 'center', cellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // 4. Pie de página
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('HRMS — Sistema de Gestión Integral de Recursos Humanos', 14, pageHeight - 8);

  const startDateStr = weekDays[0]?.dateStr || 'semana';
  const fileName = `Planificacion_Turnos_${startDateStr}.pdf`;
  doc.save(fileName);
};
