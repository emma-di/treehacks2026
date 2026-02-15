import * as React from 'react';
import { Html, Head, Body, Container, Section, Heading, Text, Img } from '@react-email/components';

export interface ScheduleAssignment {
  room: string;
  start: number;
  stop: number;
  briefing: string;
  todos: string[];
}

interface ScheduleEmailTemplateProps {
  nurseName: string;
  assignments: ScheduleAssignment[];
  /** Optional: URL to your logo or sender avatar (hosted image). Shows at top of email. */
  logoUrl?: string;
}

function formatTime(timeValue: number): string {
  if (timeValue === -1) return 'N/A';
  const hours = Math.floor(timeValue);
  const minutes = Math.round((timeValue % 1) * 60);
  const displayHours = hours % 24;
  const dayOffset = Math.floor(hours / 24);
  const timeStr = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return dayOffset > 0 ? `${timeStr} (+${dayOffset}d)` : timeStr;
}

export function ScheduleEmailTemplate({ nurseName, assignments, logoUrl }: ScheduleEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          {logoUrl && (
            <Section style={{ marginBottom: '24px', textAlign: 'center' }}>
              <Img src={logoUrl} alt="Atria" width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            </Section>
          )}
          <Section>
            <Heading style={{ color: '#1e3a5f', marginBottom: '8px' }}>Your schedule is ready</Heading>
            <Text style={{ color: '#475569', marginBottom: '24px' }}>
              Hi {nurseName}, here are your assignments from the latest run.
            </Text>
          </Section>
          {assignments.length === 0 ? (
            <Text style={{ color: '#64748b' }}>No assignments for this run.</Text>
          ) : (
            assignments.map((a, i) => (
              <Section key={i} style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Text style={{ fontSize: '16px', fontWeight: 600, color: '#1e3a5f', marginBottom: '8px' }}>
                  {a.room} · {formatTime(a.start)} – {formatTime(a.stop)}
                </Text>
                <Text style={{ color: '#475569', marginBottom: '12px', fontSize: '14px' }}>
                  {a.briefing}
                </Text>
                <Text style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>To-do</Text>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '14px' }}>
                  {a.todos.map((todo, j) => (
                    <li key={j} style={{ marginBottom: '4px' }}>{todo}</li>
                  ))}
                </ul>
              </Section>
            ))
          )}
          <Section>
            <Text style={{ color: '#94a3b8', fontSize: '12px', marginTop: '24px' }}>
              Atria · Schedule generated automatically
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
