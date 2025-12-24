import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Link,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  preview: string;
  tenantName: string;
  tenantLogo?: string;
  children: React.ReactNode;
}

export function BaseLayout({
  preview,
  tenantName,
  tenantLogo,
  children,
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {tenantLogo ? (
              <Img
                src={tenantLogo}
                width="150"
                height="50"
                alt={tenantName}
                style={logo}
              />
            ) : (
              <Text style={headerText}>{tenantName}</Text>
            )}
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} {tenantName}. All rights reserved.
            </Text>
            <Text style={footerText}>
              Powered by{' '}
              <Link href="https://retreatflow360.com" style={footerLink}>
                RetreatFlow360
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '24px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #e6ebf1',
};

const logo = {
  margin: '0 auto',
};

const headerText = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  margin: '0',
};

const content = {
  padding: '24px',
};

const divider = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  padding: '0 24px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  margin: '4px 0',
};

const footerLink = {
  color: '#556cd6',
  textDecoration: 'none',
};

export default BaseLayout;
