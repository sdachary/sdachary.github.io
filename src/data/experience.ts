import type { Experience } from './types'

const experience: Experience[] = [
  {
    company: 'Lloyds Technology Centre',
    role: 'Senior Data Analyst',
    period: 'Dec 2023 — Present · Hyderabad',
    desc: 'Built Python automation matching open job IDs to candidates (grade, top-3 skills, secondary-skill overlap) for People & Places onboarding. Drove enterprise Looker adoption via ServiceNow-to-Looker provisioning automation with AD-group role-based access. Designed Tableau metadata extraction tool feeding Power BI to auto-generate data models, cutting manual work during Tableau→Power BI/Looker migration. Owned Tableau decommission: Power Automate flows for workbook-owner outreach and SharePoint tracking. Leading re-imagining of 300-400 internal Tableau views as reusable Power BI templates on ~1.7 GB dataset migrating to Microsoft Fabric. Wrote SQL stored procedures in GCP BigQuery with row/column-level PII security for AI/Copilot-enabled dashboards. Enforced GDPR compliance on high-confidentiality HC/PII data using local 7B LLMs via MCP to eliminate data-leakage risk. Delivers ~4,000 PDF reports monthly to external stakeholders. Led Agile ceremonies, planned in Jira Align, documented in Confluence.',
  },
  {
    company: 'Wicked Ride Adventure Services',
    role: 'Team Leader, QC Operations',
    period: 'Dec 2019 — Feb 2020',
    desc: 'Managed QC operations, work order tracking, spare parts coordination, and performance reviews across teams.',
  },
  {
    company: 'Automotive Manufacturers Pvt. Ltd.',
    role: 'Sr. HR Admin',
    period: 'Sep 2016 — Nov 2019 · Hyderabad',
    desc: 'Managed compliance, employee records, onboarding, HR policy implementation and training initiatives. The foundation that taught systems thinking before data.',
  },
]

export default experience
