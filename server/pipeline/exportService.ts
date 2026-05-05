/**
 * Export Service - generiert CSV und CRM-Exporte für Leads.
 * Dependencies: Supabase
 * Env: SUPABASE_URL
 */

import { admin } from '../supabaseAdmin.js';

export interface ExportLead {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  email: string;
  linkedin: string;
  website: string;
  iqScore: number;
  stage: string;
  intentScore: number;
  createdAt: string;
  lastEvent?: string;
  lastEventAt?: string;
}

export interface HubSpotLead {
  properties: {
    email: string;
    firstname: string;
    lastname: string;
    company: string;
    jobtitle: string;
    website: string;
    linkedinbio: string;
    iq_score: number;
    lead_stage: string;
    intent_score: number;
    lead_source: string;
    created_at: string;
    last_activity: string;
  };
}

/**
 * Generiert CSV Export für Leads
 */
export async function generateCSVExport(workspaceId: string): Promise<string> {
  if (!admin) throw new Error('Supabase admin client not configured');

  try {
    // Hole alle Leads für Workspace
    const { data: leads, error } = await admin
      .from('leads')
      .select(`
        id,
        personal,
        organization,
        extraction,
        stage,
        intent_score,
        last_event,
        last_event_at,
        created_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!leads || leads.length === 0) {
      throw new Error('Keine Leads zum Exportieren gefunden');
    }

    // Transform zu CSV Format
    const csvLeads: ExportLead[] = leads.map(lead => ({
      id: lead.id,
      firstName: lead.personal?.firstName || '',
      lastName: lead.personal?.lastName || '',
      title: lead.personal?.title || '',
      company: lead.organization?.name || '',
      email: lead.personal?.email || '',
      linkedin: lead.personal?.linkedin || '',
      website: lead.organization?.website || '',
      iqScore: lead.extraction?.iqScore || 0,
      stage: lead.stage || 'source',
      intentScore: lead.intent_score || 0,
      createdAt: lead.created_at,
      lastEvent: lead.last_event || undefined,
      lastEventAt: lead.last_event_at || undefined
    }));

    // Generiere CSV Content
    const headers = [
      'first_name',
      'last_name', 
      'title',
      'company',
      'email',
      'linkedin',
      'website',
      'iq_score',
      'stage',
      'intent_score',
      'created_at',
      'last_event',
      'last_event_at'
    ];

    const csvRows = csvLeads.map(lead => [
      escapeCSV(lead.firstName),
      escapeCSV(lead.lastName),
      escapeCSV(lead.title),
      escapeCSV(lead.company),
      escapeCSV(lead.email),
      escapeCSV(lead.linkedin),
      escapeCSV(lead.website),
      lead.iqScore.toString(),
      escapeCSV(lead.stage),
      lead.intentScore.toString(),
      lead.createdAt,
      escapeCSV(lead.lastEvent || ''),
      lead.lastEventAt || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    return csvContent;

  } catch (err) {
    console.error('Failed to generate CSV export:', err);
    throw err;
  }
}

/**
 * Generiert HubSpot-kompatiblen JSON Export
 */
export async function generateHubSpotExport(workspaceId: string): Promise<HubSpotLead[]> {
  if (!admin) throw new Error('Supabase admin client not configured');

  try {
    // Hole alle Leads für Workspace
    const { data: leads, error } = await admin
      .from('leads')
      .select(`
        id,
        personal,
        organization,
        extraction,
        stage,
        intent_score,
        last_event,
        last_event_at,
        created_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!leads || leads.length === 0) {
      throw new Error('Keine Leads zum Exportieren gefunden');
    }

    // Transform zu HubSpot Format
    const hubspotLeads: HubSpotLead[] = leads.map(lead => ({
      properties: {
        email: lead.personal?.email || '',
        firstname: lead.personal?.firstName || '',
        lastname: lead.personal?.lastName || '',
        company: lead.organization?.name || '',
        jobtitle: lead.personal?.title || '',
        website: lead.organization?.website || '',
        linkedinbio: lead.personal?.linkedin || '',
        iq_score: lead.extraction?.iqScore || 0,
        lead_stage: lead.stage || 'source',
        intent_score: lead.intent_score || 0,
        lead_source: 'skerry_ai',
        created_at: lead.created_at,
        last_activity: lead.last_event_at || lead.created_at
      }
    }));

    return hubspotLeads;

  } catch (err) {
    console.error('Failed to generate HubSpot export:', err);
    throw err;
  }
}

/**
 * Generiert Salesforce-kompatiblen CSV Export
 */
export async function generateSalesforceExport(workspaceId: string): Promise<string> {
  if (!admin) throw new Error('Supabase admin client not configured');

  try {
    // Hole alle Leads für Workspace
    const { data: leads, error } = await admin
      .from('leads')
      .select(`
        id,
        personal,
        organization,
        extraction,
        stage,
        intent_score,
        last_event,
        last_event_at,
        created_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!leads || leads.length === 0) {
      throw new Error('Keine Leads zum Exportieren gefunden');
    }

    // Salesforce-spezifische Headers
    const headers = [
      'FirstName',
      'LastName',
      'Title',
      'Company',
      'Email',
      'Website',
      'LinkedIn__c',
      'IQ_Score__c',
      'Lead_Stage__c',
      'Intent_Score__c',
      'LeadSource',
      'CreatedDate',
      'LastActivityDate'
    ];

    const csvRows = leads.map(lead => [
      escapeCSV(lead.personal?.firstName || ''),
      escapeCSV(lead.personal?.lastName || ''),
      escapeCSV(lead.personal?.title || ''),
      escapeCSV(lead.organization?.name || ''),
      escapeCSV(lead.personal?.email || ''),
      escapeCSV(lead.organization?.website || ''),
      escapeCSV(lead.personal?.linkedin || ''),
      (lead.extraction?.iqScore || 0).toString(),
      escapeCSV(lead.stage || 'source'),
      (lead.intent_score || 0).toString(),
      'Skerry AI',
      lead.created_at,
      lead.last_event_at || lead.created_at
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    return csvContent;

  } catch (err) {
    console.error('Failed to generate Salesforce export:', err);
    throw err;
  }
}

/**
 * Escaped CSV Werte für korrekte Formatierung
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generiert Export-Metadaten
 */
export function generateExportMetadata(
  format: 'csv' | 'hubspot' | 'salesforce',
  leadCount: number,
  workspaceId: string
): {
  filename: string;
  mimeType: string;
  size: number;
  exportedAt: string;
  format: string;
  leadCount: number;
  workspaceId: string;
} {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `skerry-leads-${format}-${timestamp}${format === 'hubspot' ? '.json' : '.csv'}`;
  const mimeType = format === 'hubspot' ? 'application/json' : 'text/csv';

  return {
    filename,
    mimeType,
    size: 0, // Wird nach Generierung gesetzt
    exportedAt: new Date().toISOString(),
    format,
    leadCount,
    workspaceId
  };
}
