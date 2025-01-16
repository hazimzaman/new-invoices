import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import type { Invoice } from '../types/invoice';
import type { Settings } from '../types/settings';

// You'll need to import your images and convert them to base64 or host them
import logo from './primo-logo.png';
import bgImage from './Frame-7.png';

interface Props {
  invoice: Invoice;
  settings: Settings;
}


const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 12, fontFamily: 'Helvetica' },
    header: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    companyInfo: { textAlign: 'right' },
    companyLogo: { height: 50, width: 50, marginBottom: 5 },
    invoiceTitle: { fontSize: 24, fontWeight: 'bold' },
    invoiceDetails: { marginBottom: 20, position: 'relative' },
    backgroundImage: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      height: 150, 
      width: 150, 
      opacity: 0.1,
    },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    table: { 
      display: 'table', 
      width: '100%', 
      marginVertical: 20, 
      borderWidth: 0.5,  
      borderColor: '#ddd', 
    },
    tableRow: { 
      flexDirection: 'row',
      borderBottomWidth: 0.5, 
      borderColor: '#ddd', 
    },
    tableCellHeader: { 
      flex: 1, 
      borderBottomWidth: 1, 
      borderColor: '#ddd', 
      fontWeight: 'bold', 
      padding: 5 
    },
    tableCell: { 
      flex: 1, 
      padding: 5,
      borderBottomWidth: 0.5, 
      borderColor: '#ddd',  
    },
    totalSection: { marginTop: 20, textAlign: 'right' },
    footer: { marginTop: 40, textAlign: 'center', fontSize: 10 },
  });
  
  export const InvoicePDF: React.FC<Props> = ({ invoice, settings }) => (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <View style={styles.companyInfo}>
            {/* <Image style={styles.companyLogo} src={logo} /> */}
            <Text>{settings?.company_name || ''}</Text>
            <Text>{settings?.name || ''}</Text>
            <Text>{settings?.phone || ''}</Text>
            <Text>{settings?.email || ''}</Text>
            {settings?.wise_email && <Text>WISE: {settings.wise_email}</Text>}
          </View>
        </View>
  
        {/* Invoice Details Section */}
        <View style={styles.invoiceDetails}>
          <View style={styles.detailRow}>
            <Text>Invoice No:</Text>
            <Text>{invoice?.invoice_number || ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text>Bill to:</Text>
            <Text>{invoice?.client?.company_name || invoice?.client?.name || ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text>Address:</Text>
            <Text>{invoice?.client?.address || ''}</Text>
          </View>
          {invoice?.client?.vat && (
            <View style={styles.detailRow}>
              <Text>VAT:</Text>
              <Text>{invoice.client.vat}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text>Date:</Text>
            <Text>{invoice?.created_at ? new Date(invoice.created_at).toLocaleDateString() : ''}</Text>
          </View>
        </View>
  
        {/* Table Section */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCellHeader, { flex: 1 }]}>#</Text>
            <Text style={[styles.tableCellHeader, { flex: 3 }]}>Description</Text>
            <Text style={[styles.tableCellHeader, { flex: 2 }]}>Price</Text>
            <Text style={[styles.tableCellHeader, { flex: 2 }]}>Amount</Text>
          </View>
          {(invoice?.items || []).map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={[styles.tableCell, { flex: 1 }]}>{index + 1}</Text>
              <Text style={[styles.tableCell, { flex: 3 }]}>{item?.name || ''}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {item?.currency || '$'} {(item?.price || 0).toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {item?.currency || '$'} {((item?.quantity || 1) * (item?.price || 0)).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
  
        {/* Total Section */}
        <View style={styles.totalSection}>
          <Text>
            Total: {invoice?.items?.[0]?.currency || '$'} {(invoice?.total || 0).toFixed(2)}
          </Text>
        </View>
  
        {/* Footer Section */}
        <View style={styles.footer}>
          <Text>If you have any questions, please contact: {settings?.email || ''}</Text>
        </View>
      </Page>
    </Document>
  );