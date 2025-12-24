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

export interface EventReminderProps {
  tenantName: string;
  tenantLogo?: string;
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  daysUntilEvent: number;
  checklist?: string[];
  viewEventUrl: string;
  mapUrl?: string;
}

export function EventReminder({
  tenantName,
  tenantLogo,
  attendeeName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  daysUntilEvent,
  checklist,
  viewEventUrl,
  mapUrl,
}: EventReminderProps) {
  const reminderText =
    daysUntilEvent === 1
      ? "tomorrow"
      : daysUntilEvent === 0
        ? "today"
        : `in ${daysUntilEvent} days`;

  return (
    <BaseLayout
      preview={`Reminder: ${eventTitle} is ${reminderText}!`}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
    >
      <Heading style={heading}>Event Reminder</Heading>

      <Text style={paragraph}>Hi {attendeeName},</Text>

      <Text style={paragraph}>
        This is a friendly reminder that <strong>{eventTitle}</strong> is
        coming up <strong>{reminderText}</strong>! We can't wait to see you
        there.
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
      </Section>

      {checklist && checklist.length > 0 && (
        <Section style={checklistSection}>
          <Heading as="h3" style={checklistHeading}>
            Don't Forget
          </Heading>
          <ul style={checklistList}>
            {checklist.map((item, index) => (
              <li key={index} style={checklistItem}>
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section style={buttonContainer}>
        <Button style={button} href={viewEventUrl}>
          View Event Details
        </Button>

        {mapUrl && (
          <Button style={secondaryButton} href={mapUrl}>
            Get Directions
          </Button>
        )}
      </Section>

      <Text style={paragraph}>
        If you have any questions or need assistance, please don't hesitate to
        reach out.
      </Text>

      <Text style={paragraph}>
        See you soon!
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

const checklistSection = {
  backgroundColor: '#fffbeb',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #fcd34d',
};

const checklistHeading = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const checklistList = {
  margin: '0',
  paddingLeft: '20px',
};

const checklistItem = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '24px',
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

export default EventReminder;
