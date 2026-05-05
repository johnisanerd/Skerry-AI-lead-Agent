/**
 * Sequence Engine — automatisierte Follow-up-Kette pro Lead.
 * Dependencies: Supabase, OpenAI, Resend
 * Env: SUPABASE_URL, OPENAI_API_KEY, RESEND_API_KEY
 */

export interface SequenceStep {
  stepNumber: number;       // 1, 2, 3
  delayDays: number;        // 0 = sofort, 3 = nach 3 Tagen
  subjectTemplate: string;  // z.B. "Quick follow-up, {{first_name}}"
  bodyTemplate: string;     // Markdown mit {{variables}}
  condition: 'always' | 'no_reply' | 'no_open';
}

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  steps: SequenceStep[];
  isActive: boolean;
}

export interface LeadSequenceEnrollment {
  leadId: string;
  sequenceId: string;
  currentStep: number;
  status: 'active' | 'replied' | 'completed' | 'paused';
  nextSendAt: Date;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  variables: Record<string, string>;
}

/**
 * Generiert personalisierte Email aus Template + Lead-Daten
 */
export async function generateEmailFromTemplate(
  template: SequenceStep,
  lead: {
    firstName: string;
    lastName: string;
    title: string;
    organization: { name: string };
    extraction: { websiteContext: string; personContext: string };
  },
  businessDescription: string,
  senderName: string
): Promise<EmailTemplate> {
  const variables = {
    first_name: lead.firstName,
    last_name: lead.lastName,
    full_name: `${lead.firstName} ${lead.lastName}`,
    title: lead.title,
    company: lead.organization.name,
    business_description: businessDescription,
    sender_name: senderName,
    website_context: lead.extraction.websiteContext,
    person_context: lead.extraction.personContext,
  };

  // Replace variables in templates
  const replaceVariables = (text: string, vars: Record<string, string>): string => {
    let result = text;
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return result;
  };

  const subject = replaceVariables(template.subjectTemplate, variables);
  const body = replaceVariables(template.bodyTemplate, variables);

  return {
    subject,
    body,
    variables,
  };
}

/**
 * Prüft ob eine Sequence Step für den Lead ausgeführt werden soll
 */
export function shouldExecuteStep(
  enrollment: LeadSequenceEnrollment,
  step: SequenceStep,
  lastEmailEvent?: { type: string; createdAt: Date }
): boolean {
  // Step bereits abgeschlossen?
  if (enrollment.currentStep !== step.stepNumber) return false;

  // Enrollment nicht aktiv?
  if (enrollment.status !== 'active') return false;

  // Zeit noch nicht erreicht?
  if (new Date() < enrollment.nextSendAt) return false;

  // Condition prüfen
  switch (step.condition) {
    case 'always':
      return true;
    case 'no_reply':
      return !lastEmailEvent || lastEmailEvent.type !== 'replied';
    case 'no_open':
      return !lastEmailEvent || (lastEmailEvent.type !== 'opened' && lastEmailEvent.type !== 'replied');
    default:
      return true;
  }
}

/**
 * Berechnet nächsten Send-Zeitpunkt für Sequence Step
 */
export function calculateNextSendAt(
  currentStep: SequenceStep,
  lastEmailSentAt?: Date
): Date {
  const baseTime = lastEmailSentAt || new Date();
  const nextTime = new Date(baseTime);
  nextTime.setDate(nextTime.getDate() + currentStep.delayDays);
  return nextTime;
}

/**
 * Validiert Sequence Step Konfiguration
 */
export function validateSequenceStep(step: SequenceStep): string[] {
  const errors: string[] = [];

  if (step.stepNumber < 1) {
    errors.push('stepNumber muss >= 1 sein');
  }

  if (step.delayDays < 0) {
    errors.push('delayDays darf nicht negativ sein');
  }

  if (!step.subjectTemplate || step.subjectTemplate.trim().length === 0) {
    errors.push('subjectTemplate ist erforderlich');
  }

  if (!step.bodyTemplate || step.bodyTemplate.trim().length === 0) {
    errors.push('bodyTemplate ist erforderlich');
  }

  if (!['always', 'no_reply', 'no_open'].includes(step.condition)) {
    errors.push('condition muss "always", "no_reply" oder "no_open" sein');
  }

  // Prüfe ob Template-Variablen syntaktisch korrekt sind
  const templateVars = extractTemplateVariables(step.subjectTemplate + ' ' + step.bodyTemplate);
  const validVars = ['first_name', 'last_name', 'full_name', 'title', 'company', 'business_description', 'sender_name', 'website_context', 'person_context'];
  
  for (const templateVar of templateVars) {
    if (!validVars.includes(templateVar)) {
      errors.push(`Unbekannte Template-Variable: {{${templateVar}}}`);
    }
  }

  return errors;
}

/**
 * Extrahiert alle Template-Variablen aus einem String
 */
function extractTemplateVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  return matches ? matches.map(match => match.slice(2, -2)) : [];
}

/**
 * Validiert komplette Sequence
 */
export function validateSequence(sequence: Omit<Sequence, 'id'>): string[] {
  const errors: string[] = [];

  if (!sequence.name || sequence.name.trim().length === 0) {
    errors.push('Name ist erforderlich');
  }

  if (!sequence.workspaceId || sequence.workspaceId.trim().length === 0) {
    errors.push('workspaceId ist erforderlich');
  }

  if (!sequence.steps || sequence.steps.length === 0) {
    errors.push('Mindestens ein Step ist erforderlich');
  }

  // Steps prüfen
  const stepNumbers = new Set<number>();
  for (const step of sequence.steps) {
    const stepErrors = validateSequenceStep(step);
    errors.push(...stepErrors.map(err => `Step ${step.stepNumber}: ${err}`));
    
    if (stepNumbers.has(step.stepNumber)) {
      errors.push(`Doppelte stepNumber: ${step.stepNumber}`);
    }
    stepNumbers.add(step.stepNumber);
  }

  return errors;
}
