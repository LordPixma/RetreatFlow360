import {
  Button,
  Heading,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './base-layout';

export interface BookingConfirmationProps {
  tenantName: string;
  tenantLogo?: string;
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  bookingId: string;
  pricingTier: string;
  amount: string;
  currency: string;
  roomName?: string;
  viewBookingUrl: string;
  calendarUrl?: string;
}

export function BookingConfirmation({
  tenantName,
  tenantLogo,
  attendeeName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  bookingId,
  pricingTier,
  amount,
  currency,
  roomName,
  viewBookingUrl,
  calendarUrl,
}: BookingConfirmationProps) {
  return (
    <BaseLayout
      preview={`Your booking for ${eventTitle} is confirmed!`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Booking Confirmed!</Heading>

      <Text style={paragraph}>Hi {attendeeName},</Text>

      <Text style={paragraph}>
        Great news! Your booking for <strong>{eventTitle}</strong> has been
        confirmed. We're excited to have you join us!
      </Text>

      <Section style={detailsBox}>
        <Heading as="h3" style={detailsHeading}>
          Event Details
        </Heading>

        <Row style={detailRow}>
          <Column style={detailLabel}>Event</Column>
          <Column style={detailValue}>{eventTitle}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Date</Column>
          <Column style={detailValue}>{eventDate}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Time</Column>
          <Column style={detailValue}>{eventTime}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Location</Column>
          <Column style={detailValue}>{eventLocation}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Booking ID</Column>
          <Column style={detailValue}>{bookingId}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Ticket Type</Column>
          <Column style={detailValue}>{pricingTier}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Amount Paid</Column>
          <Column style={detailValue}>
            {currency} {amount}
          </Column>
        </Row>

        {roomName && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Room</Column>
            <Column style={detailValue}>{roomName}</Column>
          </Row>
        )}
      </Section>

      <Section style={buttonContainer}>
        <Button style={button} href={viewBookingUrl}>
          View My Booking
        </Button>

        {calendarUrl && (
          <Button style={secondaryButton} href={calendarUrl}>
            Add to Calendar
          </Button>
        )}
      </Section>

      <Text style={paragraph}>
        If you have any questions or need to make changes to your booking,
        please don't hesitate to contact us.
      </Text>

      <Text style={paragraph}>
        We look forward to seeing you!
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
  width: '120px',
  verticalAlign: 'top' as const,
};

const detailValue = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500',
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
  margin: '0 8px',
};

const secondaryButton = {
  backgroundColor: '#ffffff',
  border: '1px solid #556cd6',
  borderRadius: '6px',
  color: '#556cd6',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '0 8px',
};

export default BookingConfirmation;
