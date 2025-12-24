import {
  Heading,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

export interface RefundConfirmationProps {
  tenantName: string;
  tenantLogo?: string;
  attendeeName: string;
  eventTitle: string;
  refundId: string;
  refundDate: string;
  originalAmount: string;
  refundAmount: string;
  currency: string;
  reason?: string;
  estimatedArrival: string;
  supportEmail: string;
}

export function RefundConfirmation({
  tenantName,
  tenantLogo,
  attendeeName,
  eventTitle,
  refundId,
  refundDate,
  originalAmount,
  refundAmount,
  currency,
  reason,
  estimatedArrival,
  supportEmail,
}: RefundConfirmationProps) {
  const isPartialRefund = originalAmount !== refundAmount;

  return (
    <BaseLayout
      preview={`Refund processed for ${eventTitle}`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Refund Processed</Heading>

      <Text style={paragraph}>Hi {attendeeName},</Text>

      <Text style={paragraph}>
        {isPartialRefund
          ? `We've processed a partial refund for your booking to ${eventTitle}.`
          : `We've processed your refund for ${eventTitle}.`}{' '}
        The funds will be returned to your original payment method.
      </Text>

      <Section style={detailsBox}>
        <Heading as="h3" style={detailsHeading}>
          Refund Details
        </Heading>

        <Row style={detailRow}>
          <Column style={detailLabel}>Refund ID</Column>
          <Column style={detailValue}>{refundId}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Date Processed</Column>
          <Column style={detailValue}>{refundDate}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Event</Column>
          <Column style={detailValue}>{eventTitle}</Column>
        </Row>

        {isPartialRefund && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Original Amount</Column>
            <Column style={detailValue}>
              {currency} {originalAmount}
            </Column>
          </Row>
        )}

        <Row style={detailRow}>
          <Column style={detailLabel}>Refund Amount</Column>
          <Column style={highlightValue}>
            {currency} {refundAmount}
          </Column>
        </Row>

        {reason && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Reason</Column>
            <Column style={detailValue}>{reason}</Column>
          </Row>
        )}
      </Section>

      <Section style={infoBox}>
        <Text style={infoText}>
          <strong>When will I receive my refund?</strong>
          <br />
          Refunds typically take {estimatedArrival} to appear in your account,
          depending on your payment provider. If you haven't received your
          refund after this period, please check with your bank or payment
          provider.
        </Text>
      </Section>

      <Text style={paragraph}>
        If you have any questions about this refund, please contact us at{' '}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </Text>

      <Text style={paragraph}>
        We hope to see you at a future event!
        <br />
        <br />
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

const detailsHeading = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 16px 0',
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

const highlightValue = {
  color: '#059669',
  fontSize: '16px',
  fontWeight: '600',
};

const infoBox = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
  border: '1px solid #bfdbfe',
};

const infoText = {
  color: '#1e40af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const link = {
  color: '#556cd6',
  textDecoration: 'none',
};

export default RefundConfirmation;
