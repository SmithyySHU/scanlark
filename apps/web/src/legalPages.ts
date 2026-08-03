export type LegalPageSlug =
  | "terms"
  | "privacy"
  | "cookies"
  | "service-terms"
  | "methodology"
  | "contact";

export type LegalPageSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  afterParagraphs?: string[];
};

export type LegalPageContent = {
  slug: LegalPageSlug;
  path: string;
  label: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalPageSection[];
};

export type LegalPageLink = Pick<LegalPageContent, "slug" | "path" | "label">;

export const SUPPORT_EMAIL = "contact@scanlark.com";

const LAST_UPDATED = "3 August 2026";

const OPERATOR_COPY =
  "Scanlark is operated by Connor Smith in the United Kingdom.";

const CONTROLLER_COPY =
  "Connor Smith is the controller of personal information handled through Scanlark.";

const BUSINESS_ONLY_COPY =
  "Scanlark currently provides services to business customers only.";

export const LEGAL_PAGES: LegalPageContent[] = [
  {
    slug: "privacy",
    path: "/privacy",
    label: "Privacy",
    title: "Privacy Notice",
    intro:
      "This notice explains how Scanlark handles personal information for enquiries, business contacts, clients, website-health checks and authorised Operations users.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Who Is Responsible For Your Information?",
        paragraphs: [
          OPERATOR_COPY,
          CONTROLLER_COPY,
          `Email: ${SUPPORT_EMAIL}.`,
          BUSINESS_ONLY_COPY,
        ],
      },
      {
        title: "What This Notice Covers",
        paragraphs: [
          "This notice covers people who contact Scanlark, prospective clients and business contacts, current and former clients, authorised users of the Scanlark Operations platform, and people whose business contact details are published on a business website, public register or professional business page.",
          "It does not cover personal information that a client controls independently on its own website.",
        ],
      },
      {
        title: "Business Contact Details",
        paragraphs: ["Scanlark may hold business contact details such as:"],
        bullets: [
          "Name.",
          "Business email address.",
          "Business telephone number.",
          "Job title or role.",
          "Employer, trading name or organisation.",
          "Business address.",
          "Public website or professional profile.",
          "Communication preferences and objections.",
        ],
      },
      {
        title: "Enquiry And Client Records",
        paragraphs: ["Scanlark may hold enquiry and client records such as:"],
        bullets: [
          "Enquiries and correspondence.",
          "Notes about a business and its website.",
          "Meetings, calls and follow-up actions.",
          "Quotes, agreed services and work records.",
          "Reports, scans and service history.",
          "Client instructions, approvals and payment status.",
        ],
      },
      {
        title: "Public Website-Check Information",
        paragraphs: [
          "Scanlark may collect technical and publicly visible information from a website. Scanlark is designed to avoid private, authenticated or restricted areas.",
        ],
        bullets: [
          "Public URLs and page titles.",
          "Public page content needed to understand or explain a finding.",
          "Links, response codes, redirects and missing resources.",
          "Public HTTP response headers.",
          "Sitemap and robots information.",
          "Availability and scan times.",
          "Publicly displayed business contact details.",
        ],
      },
      {
        title: "Account And Technical Information",
        paragraphs: [
          "Scanlark may hold account and technical information. Please do not send passwords, special-category personal information or other highly sensitive information unless it is genuinely required and a secure method has been agreed.",
        ],
        bullets: [
          "Account email address.",
          "Authentication and session records.",
          "IP address.",
          "Browser and device information.",
          "Security, application and server logs.",
          "Actions performed inside the Operations platform.",
        ],
      },
      {
        title: "Where The Information Comes From",
        bullets: [
          "Directly from you.",
          "From your employer or organisation.",
          "Through a referral or introduction.",
          "From a public business website.",
          "From Companies House or another public business register.",
          "From a public professional or business social-media page.",
          "Through use of Scanlark systems.",
          "Through correspondence and delivery of a service.",
        ],
        afterParagraphs: [
          "Where business contact information is obtained from a public source, this notice will be made available at or before the first communication, or otherwise within the period required by data-protection law.",
        ],
      },
      {
        title: "Enquiries And Quotes",
        paragraphs: [
          "Scanlark uses contact and enquiry information to reply, understand requirements and prepare a quote.",
          "Lawful basis: taking steps at your request before entering a contract, and Scanlark's legitimate interest in managing business enquiries.",
        ],
      },
      {
        title: "Providing An Agreed Service",
        paragraphs: [
          "Scanlark uses client, website, communication and work information to prepare reports, carry out agreed website work, provide monitoring and offer support.",
          "Lawful basis: performance of a contract.",
        ],
      },
      {
        title: "Limited Business-To-Business Prospecting",
        paragraphs: [
          "Scanlark may use public business information to identify and contact organisations that may reasonably benefit from Scanlark.",
          "Unsolicited email outreach is limited to verified corporate subscribers unless consent or a valid soft opt-in applies. Messages are intended to be relevant and personalised. They identify Scanlark and include a simple way to object to further contact.",
          "Lawful basis: Scanlark's legitimate interest in developing and offering relevant B2B services, balanced against the rights and reasonable expectations of the recipient.",
        ],
      },
      {
        title: "Operating And Protecting Scanlark",
        paragraphs: [
          "Scanlark uses technical and account information to authenticate users, prevent misuse, diagnose problems, maintain availability and protect systems and information.",
          "Lawful basis: Scanlark's legitimate interest in running a secure and reliable service, and legal obligation where one applies.",
        ],
      },
      {
        title: "Administration And Legal Obligations",
        paragraphs: [
          "Scanlark may retain and use records for bookkeeping, tax, resolving disputes, enforcing agreements and responding to lawful requests.",
          "Lawful basis: legal obligation and Scanlark's legitimate interest in administering the business and establishing, exercising or defending legal claims.",
        ],
      },
      {
        title: "Direct Marketing And Objections",
        paragraphs: [
          `You can object to direct marketing at any time. Reply to the message or email ${SUPPORT_EMAIL} and ask Scanlark to stop. Scanlark will stop using your information for direct marketing.`,
          "Scanlark may keep the minimum information needed to respect the objection, such as the email address and the date of the request. This is called a suppression record.",
        ],
      },
      {
        title: "Who Information May Be Shared With",
        paragraphs: [
          "Scanlark may use suppliers that help operate the service. This currently includes website and application hosting, databases, storage and backups, business email including IONOS, security, monitoring and technical support, PDF and document generation, and legal, tax or accounting advice where needed.",
          "Scanlark may also disclose information when required by law, to deal with a legal claim, or as part of a future sale or transfer of the business subject to appropriate safeguards.",
          "Scanlark does not sell personal information.",
        ],
      },
      {
        title: "International Transfers",
        paragraphs: [
          "Some service providers may process information outside the United Kingdom. Where information is transferred outside the United Kingdom, Scanlark will use an appropriate legal transfer mechanism and safeguards where required.",
        ],
      },
      {
        title: "How Long Information Is Kept",
        paragraphs: ["Scanlark's intended retention periods are:"],
        bullets: [
          "Prospect records that do not become clients: 12 months after the last meaningful interaction.",
          "Enquiries that do not proceed: 12 months.",
          "Suppression and do-not-contact records: as long as reasonably necessary to prevent unwanted contact.",
          "Client contracts, quotes, work and financial records: up to 6 years after the relationship ends where needed for tax, contractual or legal purposes.",
          "Website reports and scan records: normally 24 months after the last service, unless a longer period is agreed or reasonably needed.",
          "Security and application logs: 90 days.",
          "Rotating backups: 30 days.",
        ],
        afterParagraphs: [
          "These periods may be extended where reasonably necessary for a dispute, fraud prevention, legal claim or legal obligation.",
        ],
      },
      {
        title: "Security",
        paragraphs: [
          "Scanlark uses access controls, authentication, restricted internal access, secure transport and logging intended to protect personal information.",
          "No internet service is completely secure. Passwords and sensitive access credentials should not be sent by ordinary email. Where access is needed for agreed work, a safer transfer method should be arranged.",
        ],
      },
      {
        title: "Your Rights",
        paragraphs: [
          `Depending on the circumstances, you may have the right to ask for a copy of your personal information, ask for inaccurate information to be corrected, ask for information to be deleted, ask for use of information to be restricted, object to processing, object at any time to direct marketing, ask for information to be transferred in certain circumstances, or withdraw consent where consent is the basis used. To make a request, email ${SUPPORT_EMAIL}. Scanlark may need to confirm your identity before acting.`,
        ],
      },
      {
        title: "Complaints",
        paragraphs: [
          "Please contact Scanlark first so there is an opportunity to put matters right.",
          "You also have the right to complain to the Information Commissioner's Office. Details are available on the ICO website.",
        ],
      },
      {
        title: "Changes To This Notice",
        paragraphs: [
          "This notice may be updated when Scanlark changes how it operates. The latest version will be published on the website with an updated date.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    path: "/cookies",
    label: "Cookies",
    title: "Cookie Notice",
    intro:
      "This notice explains the cookies and similar storage used by Scanlark's public website and private application.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Public Website",
        paragraphs: [
          "At launch, the public Scanlark website does not use advertising cookies, third-party analytics, tracking pixels, session-recording tools or behavioural profiling.",
          "The public site is intended to work without non-essential cookies.",
        ],
      },
      {
        title: "Scanlark Application",
        paragraphs: [
          "The private application at app.scanlark.com may use essential cookies or similar storage for signing authorised users in, keeping a session secure, preventing forgery or misuse, remembering security-related state and maintaining essential application functionality.",
          "These technologies are necessary for the service requested by an authorised user. They are not used for advertising.",
        ],
      },
      {
        title: "Current Essential Storage",
        bullets: [
          "ls_session: keeps an authorised user signed in securely. Typical duration: up to 30 days. Provider: Scanlark.",
          "Local or session browser storage: remembers essential application state such as theme preference, selected site preference and setup progress. Typical duration varies by browser storage type. Provider: Scanlark.",
        ],
      },
      {
        title: "Browser Controls",
        paragraphs: [
          "Most browsers allow cookies to be deleted or blocked. Blocking essential application cookies may prevent sign-in or stop parts of app.scanlark.com from working.",
        ],
      },
      {
        title: "Future Changes",
        paragraphs: [
          `If Scanlark later adds analytics or another non-essential technology, this notice will be updated and consent will be requested before that technology is used where required. Questions can be sent to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "terms",
    path: "/terms",
    label: "Website Terms",
    title: "Website Terms Of Use",
    intro: "These terms apply to the public Scanlark website.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Operator",
        paragraphs: [OPERATOR_COPY, `Email: ${SUPPORT_EMAIL}.`],
      },
      {
        title: "Using The Website",
        paragraphs: [
          "You may use the website to learn about Scanlark and contact Scanlark about business services.",
          "Scanlark may restrict access where reasonably necessary to protect the service or other users.",
        ],
        bullets: [
          "Do not attempt to gain unauthorised access to Scanlark systems or accounts.",
          "Do not interfere with the website or application.",
          "Do not introduce malware or harmful code.",
          "Do not use automated requests in a way that disrupts the service.",
          "Do not misrepresent your identity or authority.",
          "Do not copy substantial parts of the website or branding for commercial use without permission.",
          "Do not use the website unlawfully.",
        ],
      },
      {
        title: "Information On The Website",
        paragraphs: [
          "Scanlark takes reasonable care with the information published on the site, but general website content is not professional, legal, financial, security or SEO advice.",
          "Website information may be changed without notice. A service is only agreed when both sides accept a written quote, scope or service agreement.",
        ],
      },
      {
        title: "Website-Health Reports",
        paragraphs: [
          "Any sample findings, scores or report extracts are illustrative unless they relate to a specifically commissioned report.",
          "A Scanlark website-health check is based on the public pages and responses available at the time, may not cover every page, function or third-party service, is not a penetration test, does not guarantee security, availability, legal compliance, accessibility compliance, search rankings or revenue, and may contain findings that require human review and confirmation.",
          "The detailed methodology and limitations are set out on the Methodology page.",
        ],
      },
      {
        title: "Intellectual Property",
        paragraphs: [
          "The Scanlark name, branding, website design, report templates, written material and software are owned by Connor Smith or used with permission.",
          "You may view and print public pages for your own internal business use. No other licence is granted.",
          "Client-specific website content remains the property of the client or its licensors.",
        ],
      },
      {
        title: "Third-Party Links",
        paragraphs: [
          "The website may link to third-party services. Scanlark does not control those services and is not responsible for their content, availability or privacy practices.",
        ],
      },
      {
        title: "Availability",
        paragraphs: [
          "Scanlark aims to keep the website available but does not promise uninterrupted access. Access may be suspended for maintenance, security or circumstances outside Scanlark's reasonable control.",
        ],
      },
      {
        title: "Liability",
        paragraphs: [
          "Nothing in these terms excludes liability that cannot lawfully be excluded, including liability for fraud or fraudulent misrepresentation, or death or personal injury caused by negligence.",
          "Subject to that, the public website is provided for general business information. Scanlark is not responsible for a decision made solely in reliance on general website content, indirect or consequential loss arising from use of the public website, or replacing the separate terms agreed for a paid service.",
        ],
      },
      {
        title: "Privacy",
        paragraphs: [
          "Personal information is handled as described in the Scanlark Privacy Notice and Cookie Notice.",
        ],
      },
      {
        title: "Changes",
        paragraphs: [
          "Scanlark may update these terms. The latest version will be published with an updated date.",
        ],
      },
      {
        title: "Governing Law",
        paragraphs: [
          "These terms are governed by the law of England and Wales. The courts of England and Wales will have jurisdiction, subject to any rule that cannot lawfully be excluded.",
        ],
      },
    ],
  },
  {
    slug: "service-terms",
    path: "/website-health-check-terms",
    label: "Service Terms",
    title: "Scanlark Business Service Terms",
    intro:
      "These terms apply when Scanlark supplies a website-health report, website work, monitoring or related support to a business customer.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Business Customers Only",
        paragraphs: [
          OPERATOR_COPY,
          `Email: ${SUPPORT_EMAIL}.`,
          "Scanlark does not currently contract with consumers. By accepting a quote, the customer confirms it is buying for purposes connected with its trade, business, craft, profession, charity or organisation.",
        ],
      },
      {
        title: "1. How An Agreement Is Formed",
        paragraphs: [
          "An agreement is formed when the customer accepts a written Scanlark quote, scope or service proposal.",
          "The agreement consists of the accepted quote or service proposal, these business service terms, and any written amendments agreed by both sides. If there is a conflict, the accepted quote or written amendment takes priority.",
        ],
      },
      {
        title: "2. Scope Of The Service",
        paragraphs: [
          "Scanlark will provide the work described in the accepted quote.",
          "Anything not clearly included is outside scope. Extra work may require a revised quote or written approval.",
          "Website-health checks are limited to the scope described in the quote and the Methodology and Limitations page.",
        ],
      },
      {
        title: "3. Customer Authority",
        paragraphs: ["The customer confirms that:"],
        bullets: [
          "It owns the website or has authority to commission the check or work.",
          "It has authority to provide any access supplied to Scanlark.",
          "Its instructions do not infringe another person's rights.",
          "It will tell Scanlark about any restrictions or third-party requirements that may affect the work.",
          "Scanlark may pause work if authority is unclear.",
        ],
      },
      {
        title: "4. Customer Responsibilities",
        paragraphs: ["The customer will:"],
        bullets: [
          "Provide accurate information and reasonable cooperation.",
          "Provide required content, decisions and approvals on time.",
          "Arrange secure access where needed.",
          "Keep its own independent backups unless backup work is expressly included.",
          "Tell Scanlark about relevant hosting, developer or third-party arrangements.",
          "Review reports and completed work promptly.",
          "Pay agreed third-party costs where the quote says they are the customer's responsibility.",
          "Understand that delays caused by missing access, information or approval may move the estimated completion date.",
        ],
      },
      {
        title: "5. Access And Credentials",
        paragraphs: [
          "Passwords and sensitive credentials should not be sent in ordinary email or entered into general CRM notes.",
          "Where access is required, the parties should agree a secure transfer method. The customer should create restricted or temporary accounts where practical and remove access when it is no longer needed.",
        ],
      },
      {
        title: "6. Website Checks And Reports",
        paragraphs: [
          "A Scanlark report is a point-in-time review of the agreed public website scope.",
          "Findings are reviewed and prioritised for the report, but technical conditions may change after the scan.",
        ],
        bullets: [
          "Scanlark does not promise that every page, link, resource or issue will be found.",
          "Scanlark does not promise that the website is secure.",
          "Scanlark does not promise that the website complies with every law or standard.",
          "Scanlark does not promise that search rankings or revenue will improve.",
          "Scanlark does not promise that a third-party platform will remain available.",
          "Scanlark does not promise that a finding can be fixed without access, cost or third-party cooperation.",
        ],
      },
      {
        title: "7. Website Changes And Repairs",
        paragraphs: [
          "Before making changes, Scanlark may ask the customer to confirm that a suitable backup exists.",
          "Scanlark will use reasonable care, but website changes can interact with hosting, themes, plugins, content, third-party tools and code outside Scanlark's control.",
          "Where an issue is caused by a third party or falls outside the agreed scope, Scanlark may explain the next step or offer a separate quote.",
        ],
      },
      {
        title: "8. Timescales",
        paragraphs: [
          "Any completion date is an estimate unless the quote expressly states that it is fixed. Scanlark will keep the customer informed of a material delay.",
        ],
        bullets: [
          "Scanlark is not responsible for delay caused by missing client information, access or approval.",
          "Scanlark is not responsible for delay caused by a third-party provider.",
          "Scanlark is not responsible for delay caused by an outage or security event outside Scanlark's control.",
          "Scanlark is not responsible for delay caused by newly discovered work outside the agreed scope.",
          "Scanlark is not responsible for delay caused by circumstances that could not reasonably have been anticipated.",
        ],
      },
      {
        title: "9. Fees And Payment",
        paragraphs: [
          "Fees are set out in the accepted quote.",
          "Late-payment rights available under applicable law are reserved, although Scanlark will normally try to resolve an overdue payment informally first.",
        ],
        bullets: [
          "Unless the quote says otherwise, invoices are payable within 14 days.",
          "Work may be paused while an overdue invoice remains unpaid.",
          "The customer is responsible for agreed third-party charges.",
          "Scanlark is not currently VAT registered and no VAT is charged.",
        ],
      },
      {
        title: "10. Cancellation And Changes",
        paragraphs: [
          "Before work starts, either side may cancel by written notice. The customer must pay any non-refundable third-party costs already approved.",
          "After work starts, the customer may cancel by written notice but must pay for work reasonably completed and approved costs committed up to the cancellation date.",
          "A material change to scope, timing or deliverables must be agreed in writing.",
          "A recurring managed service may have separate notice or minimum-term provisions in the accepted service proposal.",
        ],
      },
      {
        title: "11. Acceptance Of Completed Work",
        paragraphs: [
          "The customer should review completed work promptly and report a clear problem within 10 business days.",
          "Scanlark will use reasonable efforts to correct a failure to deliver the agreed scope. This does not include new requirements, third-party failures, changes made by someone else, problems outside the agreed scope, or issues arising after completion.",
        ],
      },
      {
        title: "12. Intellectual Property",
        paragraphs: [
          "The customer keeps ownership of its website, content, branding and pre-existing materials.",
          "Scanlark keeps ownership of Scanlark software and tools, general methods, templates and know-how, report layouts and reusable components, and pre-existing code and materials.",
          "Once the relevant invoice is paid, the customer may use its final client report and any bespoke deliverables for its own internal business purposes and operation of its website.",
          "Unless agreed otherwise, the customer grants Scanlark permission to access and process the website and supplied materials only as needed to provide the service.",
        ],
      },
      {
        title: "13. Confidentiality",
        paragraphs: [
          "Each side will take reasonable care of confidential information received from the other and will use it only for the agreement.",
          "This obligation does not apply to information that is already public other than through a breach, was lawfully known already, is received lawfully from another source, or must be disclosed by law.",
        ],
      },
      {
        title: "14. Data Protection",
        paragraphs: [
          "Each side will comply with applicable data-protection law for information it controls.",
          "Scanlark's handling of business contacts and client records is described in its Privacy Notice.",
          "If a service later requires Scanlark to process personal information solely on the customer's instructions, the parties will agree any additional processor terms reasonably required before that processing begins.",
        ],
      },
      {
        title: "15. Liability",
        paragraphs: [
          "Nothing in the agreement excludes or limits liability where it would be unlawful to do so, including liability for fraud or fraudulent misrepresentation, death or personal injury caused by negligence, or any other liability that cannot legally be excluded.",
          "Subject to that, Scanlark is not liable for indirect or consequential loss; loss of profit, revenue, anticipated savings, goodwill or business opportunity; a third-party platform, hosting provider, plugin, theme, developer or service outside its reasonable control; or business decisions, backups, security and legal compliance that remain the customer's responsibility.",
          "Scanlark's total liability arising from a particular agreement will not exceed the greater of the total fees paid or payable under that agreement in the 12 months before the event giving rise to the claim, or GBP 500.",
        ],
      },
      {
        title: "16. Events Outside Reasonable Control",
        paragraphs: [
          "Neither side is responsible for failure or delay caused by circumstances outside its reasonable control. The affected side will notify the other where reasonably possible and take reasonable steps to reduce the effect.",
        ],
      },
      {
        title: "17. Ending The Agreement For Serious Breach",
        paragraphs: [
          "Either side may end the agreement by written notice if the other:",
        ],
        bullets: [
          "Commits a serious breach and does not correct it within a reasonable period after being asked.",
          "Becomes insolvent.",
          "Acts unlawfully in connection with the service.",
          "Creates a serious security or reputational risk that cannot reasonably be managed.",
          "Rights and obligations intended to continue after termination will remain in force.",
        ],
      },
      {
        title: "18. General Terms",
        paragraphs: [
          "Neither side may transfer the agreement without the other side's written agreement, except as part of a genuine transfer of the whole business.",
          "If part of the agreement is unenforceable, the remainder continues.",
          "A delay in enforcing a right does not waive it.",
          "No person other than the parties has a right to enforce the agreement.",
        ],
      },
      {
        title: "19. Governing Law",
        paragraphs: [
          "The agreement is governed by the law of England and Wales. The courts of England and Wales will have exclusive jurisdiction, subject to any rule that cannot lawfully be excluded.",
        ],
      },
    ],
  },
  {
    slug: "methodology",
    path: "/methodology",
    label: "Methodology",
    title: "Website-Health Check Methodology And Limitations",
    intro:
      "This page explains what a Scanlark website-health check does and does not cover.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Purpose",
        paragraphs: [
          "A website-health check is intended to identify practical problems on publicly accessible website pages that may affect visitors, reliability, trust or basic search presentation.",
          "The report is reviewed before client delivery. Related technical occurrences may be grouped into one client finding so the report remains clear and useful.",
        ],
      },
      {
        title: "What May Be Checked",
        bullets: [
          "Public page availability.",
          "Internal and external links.",
          "Missing pages and resources.",
          "Redirect behaviour.",
          "HTTPS and certificate information visible through normal web requests.",
          "Selected HTTP response headers.",
          "Sitemap and robots files.",
          "Basic page metadata.",
          "Publicly observable uptime or response failures.",
          "Repeated patterns across scanned public pages.",
        ],
      },
      {
        title: "What Is Normally Outside Scope",
        paragraphs: [
          "Unless expressly agreed in writing, a website-health check does not include:",
        ],
        bullets: [
          "Penetration testing.",
          "Exploitation of vulnerabilities.",
          "Brute force or password testing.",
          "Port scanning.",
          "Private, logged-in or restricted areas.",
          "Testing personal customer accounts.",
          "Purchasing products or submitting live orders.",
          "Full manual testing of forms or payment systems.",
          "Source-code review.",
          "Full accessibility audit.",
          "Full legal or regulatory compliance audit.",
          "Full SEO consultancy.",
          "Malware removal.",
          "Guaranteed continuous uptime monitoring.",
          "Testing every possible browser, device or user journey.",
        ],
      },
      {
        title: "Public-Only And Restrained Checking",
        paragraphs: [
          "Scanlark is designed to use ordinary public web requests and to avoid aggressive traffic.",
          "The scan may stop, limit requests or exclude areas where the website blocks automated requests, continuing may create unnecessary load, access appears private or restricted, a third-party service prevents reliable checking, or the agreed scope has been reached.",
        ],
      },
      {
        title: "Point-In-Time Result",
        paragraphs: [
          "A report reflects the website as observed during the selected scan.",
          "Websites change frequently. A page, link, certificate, hosting service or third-party tool may change after the report is generated.",
          "A successful check does not guarantee that a feature will remain available.",
        ],
      },
      {
        title: "Findings And False Positives",
        paragraphs: [
          "Automated detection can produce incomplete, blocked or misleading results. Findings are therefore reviewed before inclusion in a client report.",
          "A result may require confirmation by opening the page manually, checking the website platform, reviewing third-party service behaviour, speaking with the existing developer or host, or re-running the scan.",
          "A finding marked as excluded or false positive remains in the internal technical history where appropriate but is not included in the client report.",
        ],
      },
      {
        title: "Grouped Findings",
        paragraphs: [
          "The same underlying issue may appear on many pages.",
          "For example, missing metadata on 20 pages may be presented as one grouped finding with the number of affected pages, representative examples, one clear explanation and one recommended action.",
          "The technical evidence remains available internally and may be included in an optional appendix.",
        ],
      },
      {
        title: "Scores And Priorities",
        paragraphs: [
          "Where a score is shown, it is an internal reporting aid based on the checks and weighting used at that time. It is not an industry certification.",
          "Priorities may be adjusted after review.",
        ],
        bullets: [
          "Critical: likely to cause serious visitor impact, loss of access or another urgent problem.",
          "Important: a meaningful issue that should be addressed.",
          "Improvement: worthwhile but not normally urgent.",
          "Informational: context or a low-impact observation.",
        ],
      },
      {
        title: "Security-Related Observations",
        paragraphs: [
          "Security-header or HTTPS observations are preventative configuration checks based on public responses.",
          "They do not prove that a website is secure or insecure and do not replace a penetration test, vulnerability assessment or specialist security review.",
        ],
      },
      {
        title: "Search-Related Observations",
        paragraphs: [
          "Metadata, crawling and sitemap observations may affect how pages are presented or discovered, but Scanlark does not guarantee rankings, traffic or sales.",
          "Search engines use many factors that are outside the scope of a website-health check.",
        ],
      },
      {
        title: "Client Responsibility",
        paragraphs: [
          "The client should review the report and raise any question about context, ownership or a third-party dependency.",
          "The client remains responsible for deciding whether to make a change and for obtaining suitable professional advice where legal, security, accessibility or specialist SEO assurance is required.",
        ],
      },
      {
        title: "Questions",
        paragraphs: [
          `Questions about scope or a finding can be sent to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "contact",
    path: "/contact",
    label: "Contact",
    title: "Contact",
    intro:
      "Contact Scanlark about business website-health checks, managed monitoring and service questions.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Email",
        paragraphs: [
          `Use ${SUPPORT_EMAIL} for website-health check enquiries and service questions.`,
        ],
      },
      {
        title: "Business Details",
        paragraphs: [
          "Scanlark is operated by Connor Smith in the United Kingdom. Business services only.",
        ],
      },
      {
        title: "Launch Scope",
        paragraphs: [
          "Scanlark is B2B-only at launch. It does not offer public self-service registration or consumer services from the public website.",
        ],
      },
    ],
  },
];

export const LEGAL_PAGE_BY_SLUG = Object.fromEntries(
  LEGAL_PAGES.map((page) => [page.slug, page]),
) as Record<LegalPageSlug, LegalPageContent>;

export const LEGAL_PAGE_LINKS: LegalPageLink[] = LEGAL_PAGES.map(
  ({ slug, path, label }) => ({ slug, path, label }),
);

export function getLegalPageSlugFromPath(path: string): LegalPageSlug | null {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized === "/acceptable-use") return "service-terms";
  if (normalized === "/report-abuse") return "contact";
  const match = LEGAL_PAGES.find((page) => page.path === normalized);
  return match?.slug ?? null;
}
