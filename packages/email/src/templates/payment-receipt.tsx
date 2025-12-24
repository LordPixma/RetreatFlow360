import {
  Button,
  Heading,
  Section,
  Text,
  Row,
  Column,
  Hr,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

export interface PaymentReceiptProps {
  tenantName: string;
  tenantLogo?: string;
  attendeeName: string;
  eventTitle: string;
  paymentId: string;
  paymentDate: string;
  paymentMethod: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax?: string;
  total: string;
  currency: string;
  viewReceiptUrl: string;
}

export function PaymentReceipt({
  tenantName,
  tenantLogo,
  attendeeName,
  eventTitle,
  paymentId,
  paymentDate,
  paymentMethod,
  items,
  subtotal,
  tax,
  total,
  currency,
  viewReceiptUrl,
}: PaymentReceiptProps) {
  return (
    <BaseLayout
      preview={`Payment receipt for ${eventTitle}`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Payment Receipt</Heading>

      <Text style={paragraph}>Hi {attendeeName},</Text>

      <Text style={paragraph}>
        Thank you for your payment! Here's your receipt for your records.
      </Text>

      <Section style={detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Receipt #</Column>
          <Column style={detailValue}>{paymentId}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Date</Column>
          <Column style={detailValue}>{paymentDate}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Payment Method</Column>
          <Column style={detailValue}>{paymentMethod}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Event</Column>
          <Column style={detailValue}>{eventTitle}</Column>
        </Row>
      </Section>

      <Section style={itemsSection}>
        <Heading as="h3" style={itemsHeading}>
          Items
        </Heading>

        <Row style={itemHeader}>
          <Column style={itemDescriptionHeader}>Description</Column>
          <Column style={itemQtyHeader}>Qty</Column>
          <Column style={itemPriceHeader}>Price</Column>
          <Column style={itemTotalHeader}>Total</Column>
        </Row>

        <Hr style={itemDivider} />

        {items.map((item, index) => (
          <Row key={index} style={itemRow}>
            <Column style={itemDescription}>{item.description}</Column>
            <Column style={itemQty}>{item.quantity}</Column>
            <Column style={itemPrice}>
              {currency} {item.unitPrice}
            </Column>
            <Column style={itemTotal}>
              {currency} {item.total}
            </Column>
          </Row>
        ))}

        <Hr style={itemDivider} />

        <Row style={summaryRow}>
          <Column style={summaryLabel}>Subtotal</Column>
          <Column style={summaryValue}>
            {currency} {subtotal}
          </Column>
        </Row>

        {tax && (
          <Row style={summaryRow}>
            <Column style={summaryLabel}>Tax</Column>
            <Column style={summaryValue}>
              {currency} {tax}
            </Column>
          </Row>
        )}

        <Row style={totalRow}>
          <Column style={totalLabel}>Total</Column>
          <Column style={totalValue}>
            {currency} {total}
          </Column>
        </Row>
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={viewReceiptUrl}>
          View Full Receipt
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions about this payment, please don't hesitate to
        contact us.
      </Text>

      <Text style={paragraph}>
        Best regards,
        <br />
        The {tenantName} Team
      </Text>
    </BaseLayout>
  );
}

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '30px 0',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const detailsBox = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const detailRow = {
  margin: '8px 0',
};

const detailLabel = {
  color: '#8898aa',
  fontSize: '14px',
  width: '140px',
  verticalAlign: 'top' as const,
};

const detailValue = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500',
};

const itemsSection = {
  margin: '24px 0',
  padding: '0 8px',
};

const itemsHeading = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 16px 0',
};

const itemHeader = {
  marginBottom: '8px',
};

const itemDescriptionHeader = {
  color: '#8898aa',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  width: '50%',
};

const itemQtyHeader = {
  color: '#8898aa',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  width: '10%',
  textAlign: 'center' as const,
};

const itemPriceHeader = {
  color: '#8898aa',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  width: '20%',
  textAlign: 'right' as const,
};

const itemTotalHeader = {
  color: '#8898aa',
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  width: '20%',
  textAlign: 'right' as const,
};

const itemDivider = {
  borderColor: '#e6ebf1',
  margin: '8px 0',
};

const itemRow = {
  margin: '12px 0',
};

const itemDescription = {
  color: '#1a1a1a',
  fontSize: '14px',
  width: '50%',
};

const itemQty = {
  color: '#525f7f',
  fontSize: '14px',
  width: '10%',
  textAlign: 'center' as const,
};

const itemPrice = {
  color: '#525f7f',
  fontSize: '14px',
  width: '20%',
  textAlign: 'right' as const,
};

const itemTotal = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500',
  width: '20%',
  textAlign: 'right' as const,
};

const summaryRow = {
  margin: '8px 0',
};

const summaryLabel = {
  color: '#8898aa',
  fontSize: '14px',
  width: '80%',
  textAlign: 'right' as const,
  paddingRight: '16px',
};

const summaryValue = {
  color: '#525f7f',
  fontSize: '14px',
  width: '20%',
  textAlign: 'right' as const,
};

const totalRow = {
  margin: '12px 0',
  paddingTop: '8px',
  borderTop: '2px solid #1a1a1a',
};

const totalLabel = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  width: '80%',
  textAlign: 'right' as const,
  paddingRight: '16px',
};

const totalValue = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  width: '20%',
  textAlign: 'right' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#556cd6',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

export default PaymentReceipt;
