
import { VehicleEntry, AccessType, WorkShift, SectorContact, BreakfastRecord, PackageRecord, Meter, MeterReading, PatrolRecord } from '../types';
import { db } from './db';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCSVDateTime = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const formatTimeOnly = (dateStr?: string) => {
  if (!dateStr) return '--:--';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const optimizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max_width = 1200;

        if (width > max_width) {
          height *= max_width / width;
          width = max_width;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const generatePatrolsPDF = async (
  patrols: PatrolRecord[],
  startDate: string,
  endDate: string,
  operatorName: string
) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // CAPA
  doc.setFillColor(15, 23, 42); 
  doc.rect(0, 0, pageWidth, 50, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("Relatório de Rondas Preventivas", margin, 32);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`, margin, 65);
  doc.text(`Gerado por: ${operatorName}`, margin, 72);
  doc.text(`Data de Geração: ${new Date().toLocaleString()}`, margin, 79);
  doc.text(`Total de Rondas no Período: ${patrols.length}`, margin, 86);

  let currentY = 100;

  for (const patrol of patrols) {
    if (currentY + 60 > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    // Header da Ronda
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 25, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Ronda #${patrol.id} - ${patrol.data.split('-').reverse().join('/')}`, margin + 5, currentY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Início: ${formatTimeOnly(patrol.horaInicio)} | Fim: ${formatTimeOnly(patrol.horaFim || '')} | Duração: ${patrol.duracaoMinutos || 0} min`, margin + 5, currentY + 18);
    doc.text(`Porteiro: ${patrol.porteiro}`, margin + 5, currentY + 22);

    currentY += 30;

    // Observações
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", margin, currentY);
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(patrol.observacoes || "Nenhuma observação registrada.", pageWidth - (margin * 2));
    doc.text(obsLines, margin, currentY + 5);
    currentY += (obsLines.length * 5) + 10;

    // Fotos
    if (patrol.fotos && patrol.fotos.length > 0) {
      const photoWidth = (pageWidth - (margin * 2) - 10) / 2;
      const photoHeight = 55;
      let col = 0;

      for (const photo of patrol.fotos) {
        if (currentY + photoHeight + 10 > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }

        const xPos = margin + (col * (photoWidth + 10));
        try {
          doc.addImage(photo.imagemBase64, 'JPEG', xPos, currentY, photoWidth, photoHeight);
        } catch (e) {
          console.error("Erro PDF Ronda Foto", e);
        }

        if (col === 1) {
          col = 0;
          currentY += photoHeight + 10;
        } else {
          col = 1;
        }
      }
      if (col === 1) currentY += photoHeight + 10;
    }
    
    currentY += 10; // Espaço entre rondas
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY - 5, pageWidth - margin, currentY - 5);
  }

  doc.save(`Relatorio_Rondas_${startDate}_a_${endDate}.pdf`);
};

export const generateMetersPDF = async (
  selectedMeters: Meter[], 
  startDate: string, 
  endDate: string,
  operatorName: string
) => {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // --- PÁGINA DE CAPA ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Medidores", margin, 35);
  
  doc.setTextColor(100, 116, 139); // Slate 400
  doc.setFontSize(10);
  doc.text("SISTEMA PORTARIA EXPRESS", margin, 45);

  doc.setTextColor(30, 41, 59); // Slate 800
  doc.setFontSize(12);
  doc.text(`Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`, margin, 80);
  doc.text(`Gerado por: ${operatorName}`, margin, 88);
  doc.text(`Data de Geração: ${new Date().toLocaleString()}`, margin, 96);

  doc.setFontSize(14);
  doc.text("Medidores Incluídos:", margin, 115);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  selectedMeters.forEach((m, idx) => {
    doc.text(`• ${m.name} (${m.type})`, margin + 5, 125 + (idx * 8));
  });

  // --- PROCESSAR CADA MEDIDOR ---
  for (const meter of selectedMeters) {
    doc.addPage();
    
    // Título do Medidor
    doc.setFillColor(8, 145, 178); // Cyan 600
    doc.rect(margin, 15, pageWidth - (margin * 2), 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(meter.name.toUpperCase(), margin + 5, 23);

    const allReadings = db.getReadingsByMeter(meter.id);
    const filteredReadings = allReadings.filter(r => {
      const d = r.timestamp.split('T')[0];
      return d >= startDate && d <= endDate;
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (filteredReadings.length === 0) {
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(12);
      doc.text("Sem registros no período selecionado.", margin, 45);
      continue;
    }

    const tableData = filteredReadings.map(r => [
      new Date(r.timestamp).toLocaleDateString(),
      new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      r.value.toString(),
      `+${r.consumption}`,
      r.operator
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Hora', `Leitura (${meter.unit})`, 'Consumo', 'Operador']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    const totalConsumo = filteredReadings.reduce((acc, r) => acc + r.consumption, 0);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total consumido no período: ${totalConsumo} ${meter.unit}`, margin, finalY + 15);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("Galeria de Fotos do Período:", margin, finalY + 25);

    const photoWidth = (pageWidth - (margin * 2) - 10) / 2;
    const photoHeight = 50;
    let currentY = finalY + 30;
    let col = 0;

    for (let i = 0; i < filteredReadings.length; i++) {
      const r = filteredReadings[i];
      
      // Verifica se precisa de nova página
      if (currentY + photoHeight + 15 > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        col = 0;
      }

      const xPos = margin + (col * (photoWidth + 10));

      try {
        if (r.photo) {
          doc.addImage(r.photo, 'JPEG', xPos, currentY, photoWidth, photoHeight);
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text(`Leitura: ${r.value} | Data: ${new Date(r.timestamp).toLocaleDateString()}`, xPos, currentY + photoHeight + 5);
        }
      } catch (err) {
        console.error("Erro ao adicionar imagem ao PDF", err);
      }

      // Lógica de colunas (2 por linha)
      if (col === 1) {
        col = 0;
        currentY += photoHeight + 15;
      } else {
        col = 1;
        // Se for a última foto e estiver na primeira coluna, garante que o cursor de Y não mude para o próximo medidor incorretamente
        if (i === filteredReadings.length - 1) {
           currentY += photoHeight + 15;
        }
      }
    }
  }

  doc.save(`Relatorio_Medidores_${startDate}_a_${endDate}.pdf`);
};

export const generateWhatsAppLink = (entry: VehicleEntry, targetPhone: string) => {
  let message = '';

  switch (entry.accessType) {
    case AccessType.CAMINHAO:
      message = `🚛 *SOLICITAÇÃO DE ACESSO – PORTARIA*
*Motorista:* ${entry.driverName}
*Transportadora:* ${entry.company}
*Destinatário:* ${entry.supplier || 'N/A'}
*Operação:* ${entry.operationType}
*NF/Pedido:* ${entry.orderNumber}
*Placa:* ${entry.vehiclePlate}
${entry.trailerPlate ? `*Placa Reboque:* ${entry.trailerPlate}` : ''}`;
      break;

    case AccessType.CARRO:
    case AccessType.MOTO:
      const icon = entry.accessType === AccessType.CARRO ? '🚗' : '🏍️';
      message = `${icon} *SOLICITAÇÃO DE ACESSO – PORTARIA*
*Visitante:* ${entry.driverName}
*Transportadora/Empresa:* ${entry.company}
*Destinatário:* ${entry.supplier || 'N/A'}
*Placa:* ${entry.vehiclePlate}
*Destino:* ${entry.sector || 'Não informado'}
*Motivo:* ${entry.visitReason || 'Não informado'}`;
      break;

    case AccessType.PEDESTRE:
      message = `🚶 *SOLICITAÇÃO DE ACESSO – PORTARIA*
*Visitante:* ${entry.driverName}
*Documento:* ${entry.documentNumber}
*Empresa:* ${entry.company}
*Destino:* ${entry.sector || 'Não informado'}
*Motivo:* ${entry.visitReason || 'Não informado'}`;
      break;
  }

  message += `\n\n*Autoriza a entrada?*`;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${targetPhone.replace(/\D/g, '')}?text=${encodedMessage}`;
};

export const getUniqueProfiles = (entries: VehicleEntry[]) => {
  const profilesMap = new Map<string, VehicleEntry>();
  
  const sorted = [...entries].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  sorted.forEach(entry => {
    const key = `${entry.driverName.toLowerCase()}|${(entry.vehiclePlate || entry.documentNumber || '').toLowerCase()}`;
    if (!profilesMap.has(key)) {
      profilesMap.set(key, entry);
    }
  });

  return Array.from(profilesMap.values());
};

export const exportPackagesToCSV = (records: PackageRecord[], date: string) => {
  const filename = `Relatorio_Encomendas_${date}.csv`;
  const headers = ['Empresa', 'Destinatário', 'Descrição', 'Recebido Em', 'Porteiro', 'Status', 'Entregue Em', 'Retirado Por', 'Tipo Retirada'];
  
  const rows = records.map(r => [
    r.deliveryCompany.replace(/;/g, ','),
    r.recipientName.replace(/;/g, ','),
    (r.description || '').replace(/;/g, ','),
    formatCSVDateTime(r.receivedAt),
    r.operatorName,
    r.status,
    r.deliveredAt ? formatCSVDateTime(r.deliveredAt) : '',
    (r.deliveredTo || '').replace(/;/g, ','),
    r.pickupType || ''
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportBreakfastToCSV = (records: BreakfastRecord[], date: string) => {
  const filename = `Relatorio_Desjejum_${date}.csv`;
  const headers = ['Nome', 'Tipo', 'Status', 'Entregue Em', 'Porteiro Responsável', 'Origem'];
  
  const rows = records.map(r => [
    r.personName.replace(/;/g, ','),
    r.breakfastType,
    r.status,
    r.deliveredAt ? formatCSVDateTime(r.deliveredAt) : 'Pendente',
    (r.operatorName || 'N/A').replace(/;/g, ','),
    r.origin
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportMasterDataToJSON = (profiles: VehicleEntry[]) => {
  const session = db.getSession();
  const operatorName = session?.operatorName || 'Porteiro';
  const date = new Date().toISOString().split('T')[0];
  const filename = `base_dados_${operatorName}_${date}.json`;

  const dataStr = JSON.stringify({
    version: "1.0",
    type: "MASTER_DATA",
    entries: profiles
  }, null, 2);

  downloadJSON(dataStr, filename);
};

export const exportContactsToJSON = (contacts: SectorContact[]) => {
  const date = new Date().toISOString().split('T')[0];
  const filename = `contatos_whatsapp_${date}.json`;

  const dataStr = JSON.stringify({
    version: "1.0",
    type: "CONTACTS",
    contacts: contacts
  }, null, 2);

  downloadJSON(dataStr, filename);
};

const downloadJSON = (dataStr: string, filename: string) => {
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToCSV = (entries: VehicleEntry[], startDate?: string, endDate?: string) => {
  const session = db.getSession();
  const operatorName = session?.operatorName || 'Porteiro';
  
  let dateSuffix = '';
  if (startDate && endDate) {
    dateSuffix = startDate === endDate ? startDate : `${startDate}_a_${endDate}`;
  } else {
    dateSuffix = new Date().toISOString().split('T')[0];
  }
  
  const filename = `Relatorio_Atendimentos_${operatorName}_${dateSuffix}.csv`;

  const headers = [
    'Data Registro', 'Porteiro', 'Dispositivo', 'Autorizado Por', 'Tipo Acesso', 
    'Nome/Motorista', 'Transportadora', 'Destinatário', 'Documento', 'Visitado', 
    'Motivo', 'Operação', 'Placa Veículo', 'Placa Reboque', 'NF/Pedido', 
    'Entrada', 'Saída', 'Status', 'Qtd Volumes', 'Setor Destino', 
    'Observações Entrada', 'Observações Saída', 'Motivo Recusa'
  ];

  const rows = entries.map(e => {
    const escape = (text?: string) => (text || '').replace(/;/g, ',');
    return [
      formatCSVDateTime(e.createdAt), escape(e.operatorName), escape(e.deviceName),
      escape(e.authorizedBy || 'N/A'), e.accessType, escape(e.driverName),
      escape(e.company), escape(e.supplier || 'N/A'), escape(e.documentNumber || 'N/A'),
      escape(e.visitedPerson || 'N/A'), escape(e.visitReason), e.operationType || 'N/A',
      e.vehiclePlate || 'N/A', e.trailerPlate || 'N/A', e.orderNumber || 'N/A',
      formatCSVDateTime(e.entryTime), formatCSVDateTime(e.exitTime), e.status,
      e.volumes || 0, e.sector || 'N/A', escape(e.observations),
      escape(e.exitObservations), escape(e.rejectionReason)
    ];
  });
  
  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportShiftsToCSV = (shifts: WorkShift[], startDate: string, endDate: string) => {
  const filtered = shifts.filter(s => s.date >= startDate && s.date <= endDate);
  const session = db.getSession();
  const operatorName = session?.operatorName || 'Porteiro';
  const filename = `Expediente_${operatorName}_${startDate}_a_${endDate}.csv`;

  const headers = ['Data', 'Operador', 'Entrada', 'Início Almoço', 'Fim Almoço', 'Saída'];

  const rows = filtered.map(s => [
    s.date, s.operatorName, formatTimeOnly(s.clockIn),
    formatTimeOnly(s.lunchStart), formatTimeOnly(s.lunchEnd), formatTimeOnly(s.clockOut)
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
