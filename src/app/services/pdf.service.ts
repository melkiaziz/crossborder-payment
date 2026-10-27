import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  // ========================================
  // 📄 EXPORT LISTE DES BANQUES
  // ========================================
  exportBanksList(banks: any[]) {
    console.log('📄 Exporting banks list:', banks);
    
    if (!banks || banks.length === 0) {
      alert('Aucune banque à exporter');
      return;
    }

    // Créer le document PDF
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(13, 110, 253);
    doc.text('🏦 Liste des Banques', 105, 20, { align: 'center' });
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const dateStr = new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Généré le ${dateStr}`, 105, 30, { align: 'center' });
    
    // Préparer les données
    const tableData = banks.map((bank, index) => [
      index + 1,
      bank.name || 'N/A',
      bank.country || 'N/A',
      bank.currency || 'N/A',
      this.formatBalance(bank.balance)
    ]);
    
    // Créer le tableau avec autoTable
    autoTable(doc, {
      startY: 40,
      head: [['#', 'Nom', 'Pays', 'Devise', 'Balance']],
      body: tableData,
      headStyles: { 
        fillColor: [13, 110, 253],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 12
      },
      alternateRowStyles: { 
        fillColor: [248, 249, 250]
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      columnStyles: {
        0: { cellWidth: 15 },
        4: { halign: 'right' }
      }
    });
    
    // Footer
    const pageCount = (doc as any).internal.pages.length - 1;
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(
      'CrossBorder Payment - Système de transferts interbancaires',
      105,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    
    // Sauvegarder
    const filename = `Banques_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    console.log('✅ Banks list PDF generated successfully');
  }

  // ========================================
  // 📄 EXPORT REÇU DE TRANSACTION
  // ========================================
  exportTransferReceipt(transaction: any) {
    console.log('📄 Exporting transaction receipt:', transaction);
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(13, 110, 253);
    doc.text('📄 Reçu de Transfert', 105, 20, { align: 'center' });
    
    // Ligne de séparation
    doc.setDrawColor(13, 110, 253);
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);
    
    // Numéro de transaction
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    let y = 35;
    doc.text(`Transaction #${transaction.id}`, 20, y);
    y += 10;
    
    // Date
    const date = new Date(transaction.date || transaction.created_at);
    doc.text(`Date: ${date.toLocaleString('fr-FR')}`, 20, y);
    y += 15;
    
    // Encadré des détails
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(15, y, 180, 90);
    y += 10;
    
    // Détails
    doc.setFontSize(11);
    doc.text(`De (émetteur):`, 20, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(this.shortenAddress(transaction.from_bank), 20, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    doc.setFontSize(11);
    doc.text(`Vers (destinataire):`, 20, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(this.shortenAddress(transaction.to_bank), 20, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    doc.setFontSize(11);
    doc.text(`Montant original:`, 20, y);
    doc.setFontSize(12);
    doc.setTextColor(13, 110, 253);
    doc.text(this.formatAmount(transaction.original_amount), 190, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    doc.setFontSize(11);
    doc.text(`Montant converti:`, 20, y);
    doc.setFontSize(12);
    doc.setTextColor(25, 135, 84);
    doc.text(this.formatAmount(transaction.converted_amount), 190, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    doc.setFontSize(11);
    doc.text(`Frais de transaction:`, 20, y);
    doc.setFontSize(12);
    doc.setTextColor(220, 53, 69);
    doc.text(this.formatAmount(transaction.fee), 190, y, { align: 'right' });
    y += 15;
    
    // Statut
    doc.setFontSize(14);
    doc.setTextColor(25, 135, 84);
    doc.text('✅ Statut: Complété', 105, y, { align: 'center' });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(
      'CrossBorder Payment - Système de transferts interbancaires',
      105,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    
    // Sauvegarder
    const filename = `Recu_${transaction.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    console.log('✅ Transaction receipt PDF generated successfully');
  }

  // ========================================
  // 📊 EXPORT RAPPORT MENSUEL
  // ========================================
  exportMonthlyReport(transactions: any[]) {
    console.log('📊 Exporting monthly report:', transactions.length, 'transactions');
    
    if (!transactions || transactions.length === 0) {
      alert('Aucune transaction à exporter');
      return;
    }

    const doc = new jsPDF();
    
    // Calculer les statistiques
    let totalVolume = 0;
    let totalFees = 0;
    
    transactions.forEach(t => {
      const amount = parseFloat(t.original_amount || t.amount || 0);
      const fee = parseFloat(t.fee || 0);
      if (!isNaN(amount)) totalVolume += amount;
      if (!isNaN(fee)) totalFees += fee;
    });
    
    const average = totalVolume / transactions.length;
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(13, 110, 253);
    const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    doc.text(`📊 Rapport Mensuel - ${month}`, 105, 20, { align: 'center' });
    
    // KPIs
    let y = 35;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    // Encadré KPIs
    doc.setFillColor(240, 248, 255);
    doc.rect(15, y, 180, 40, 'F');
    y += 10;
    
    doc.text(`Nombre de transactions: ${transactions.length}`, 20, y);
    y += 8;
    doc.text(`Volume total: ${this.formatAmount(totalVolume)}`, 20, y);
    y += 8;
    doc.text(`Frais totaux: ${this.formatAmount(totalFees)}`, 20, y);
    y += 8;
    doc.text(`Montant moyen: ${this.formatAmount(average)}`, 20, y);
    y += 15;
    
    // Préparer les données du tableau
    const tableData = transactions.map((t, index) => {
      const date = new Date(t.date || t.created_at);
      return [
        index + 1,
        date.toLocaleDateString('fr-FR'),
        this.shortenAddress(t.from_bank),
        this.shortenAddress(t.to_bank),
        this.formatAmount(t.original_amount),
        this.formatAmount(t.fee)
      ];
    });
    
    // Tableau avec autoTable
    autoTable(doc, {
      startY: y,
      head: [['#', 'Date', 'De', 'Vers', 'Montant', 'Frais']],
      body: tableData,
      foot: [[
        '',
        'TOTAL',
        '',
        '',
        this.formatAmount(totalVolume),
        this.formatAmount(totalFees)
      ]],
      headStyles: {
        fillColor: [13, 110, 253],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      footStyles: {
        fillColor: [25, 135, 84],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' }
      }
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(
      'CrossBorder Payment - Système de transferts interbancaires',
      105,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    
    // Sauvegarder
    const filename = `Rapport_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    
    console.log('✅ Monthly report PDF generated successfully');
  }

  // ========================================
  // 🛠️ HELPERS
  // ========================================
  
  private formatAmount(amount: any): string {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00 TND';
    return `${num.toFixed(2)} TND`;
  }

  private formatBalance(balance: any): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  }

  private shortenAddress(address: string): string {
    if (!address || address.length < 10) return address || 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}