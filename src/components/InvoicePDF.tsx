import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { InvoiceWithClient } from '../types/invoice';
import type { Settings } from '../types/settings';

import logo from './primo-logo.png';
import bgImage from './Frame-7.png';

import montserratRegular from './Montserrat-Regular.ttf';
import montserratBold from './Montserrat-Bold.ttf';
import openSansRegular from './OpenSans-Regular.ttf';
import openSansBold from './OpenSans-Bold.ttf';

interface InvoicePDFProps {
  invoice: InvoiceWithClient;
  settings: Settings;
}


Font.register({
  family: 'Montserrat',
  fonts: [
    {
      src: montserratRegular,
      fontWeight: 'normal',
    },
    {
      src: montserratBold,
      fontWeight: 'bold',
    }
  ]
});

Font.register({
  family: 'OpenSans',
  fonts: [
    {
      src: openSansRegular,
      fontWeight: 'normal',
    },
    {
      src: openSansBold,
      fontWeight: 'bold',
    }
  ]
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'OpenSans',
    padding: '40 40 20 40',
    fontSize: 10.5,
    position: 'relative',
  },
  invoiceContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    gap: 25,
  },
  blobWrapper: {
    position: 'absolute',
    width: 200,
    height: 503,
    left: -100,
    zIndex: -1,
    opacity: 0.12,
    top: 80,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceTitle: {
    fontSize: 48.6,
    fontFamily: 'Montserrat',
    fontWeight: 400,
    letterSpacing: 2,
    marginTop: 30,
    alignSelf: 'center',
  },
  companyInfo: {
    textAlign: 'right',
    alignItems: 'flex-end',
    marginBottom:15,
  },
  companyLogo: {
    width: 64,
    height: 64,
    marginBottom: 8,
    marginLeft: 'auto',
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'Montserrat',
    marginBottom: 4,
  },
  companyDetail: {
    marginBottom: 2,
  },
  contactName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  wise: {
    marginTop: 4,
  },
  invoiceDetails: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
    width:  'auto'
  },
  leftDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    rowGap: 2,
    transform: 'translateY(-50px)',
  },
  detailRow: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
    columnGap: 10
  },
  detailLabel: {
    fontWeight: 'bold',
    marginRight: 10,
    minWidth: 70,
    display: 'inline-block',
  },
  billTo: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: 2,
  },
  table: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    borderWidth: 1,
    transform: 'translateY(-50px)',
    borderColor: '#eee',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#fafafa',
    borderBottomWidth: 2,
    borderBottomColor: '#eee',
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
  },
  tableCell2: {
    flex: 3,
    fontSize: 10,
  },
  tableCellAmount: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
  },
  totalSection: {
    marginTop: 0,
    textAlign: 'right',
    paddingRight: 8,
    transform: 'translateY(-50px)',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    marginTop: 'auto',
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.03,
  },
  dateSection: {
    position: 'absolute',
    top: 40,
    right: 60,
    fontSize: 10,
    color: '#666',
  },
  clientCompanyName: {
    fontWeight: 'bold',
  },
  wiseLabel: {
    fontWeight: 'bold',
  },
  itemName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
});

const calculateTotal = (items: any[]) => {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
};

export const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, settings }) => {
  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || isNaN(amount)) return '0';
    return amount.toString();
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.invoiceContainer}>
          <View style={styles.blobWrapper}>
            <Image src={bgImage} />
          </View>
          
          <View style={styles.header}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.companyInfo}>
              <Image style={styles.companyLogo} src={logo} />
              <Text style={styles.companyName}>{settings.business_name}</Text>
              <Text style={styles.contactName}>{settings.contact_name}</Text>
              <Text style={styles.companyDetail}>{settings.contact_phone}</Text>
              <Text style={styles.companyDetail}>{settings.business_address}</Text>
              {settings.wise_email && (
                <Text style={styles.wise}>
                  <Text style={styles.wiseLabel}>WISE: </Text>
                  {settings.wise_email}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.invoiceDetails}>
            <View style={styles.leftDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice No:</Text>
                <Text>{invoice?.invoice_number}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bill to:</Text>
                <View style={styles.billTo}>
                  <Text style={styles.clientCompanyName}>{invoice?.client?.company_name}</Text>
                <Text>{invoice?.client?.name}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text>{invoice?.client?.client_address}</Text>
              </View>
              {invoice?.client?.tax_number && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{invoice?.client?.tax_type}:</Text>
                  <Text>{invoice?.client?.tax_number}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>#</Text>
              <Text style={styles.tableCell2}>Item</Text>
              <Text style={styles.tableCell}>Price</Text>
              <Text style={styles.tableCellAmount}>Amount</Text>
            </View>
            {(invoice?.items || []).map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableCell}>{index + 1}.</Text>
                <Text style={styles.tableCell2}>
                  <Text style={styles.itemName}>{item?.name}</Text>
                  {item?.description && (
                    <Text>{'\n'}{item?.description}</Text>
                  )}
                </Text>
                <Text style={styles.tableCell}>
                  {invoice?.client?.currency || '$'}{formatCurrency(item?.price)}
                </Text>
                <Text style={styles.tableCellAmount}>
                  {invoice?.client?.currency || '$'}{formatCurrency(item?.price)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>
              Total &nbsp; &nbsp;  &nbsp; &nbsp;{invoice?.client?.currency || '$'}{formatCurrency(calculateTotal(invoice?.items || []))}
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>If you have any questions, please contact: {settings.contact_email}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};