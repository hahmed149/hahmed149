// Content for the road trip. Sections run in career order; each obstacle is one
// accomplishment to drive through. `label` is what's painted on the barricade.

export const person = {
  name: 'Hamza Ahmed',
  role: 'Staff Software Engineer, AI/ML Solutions Architect',
  location: 'Chicago, IL',
  email: 'hahmed149@outlook.com',
  linkedin: 'https://www.linkedin.com/in/hahmed149/',
  github: 'https://github.com/hahmed149',
  summary:
    'I build enterprise AI platforms and healthcare software: HIPAA-scoped AI agents on AWS Bedrock, ' +
    'scheduling integrations, and the testing and migration foundations that let teams ship safely.',
};

// Kansas State coursework, by semester. Grades intentionally omitted.
export const semesters = [
  { term: 'Fall 2014', date: '2014-08', courses: [
    ['ECE 210', 'Intro to Electrical Engineering'], ['ENGL 100', 'Expository Writing'], ['MATH 220', 'Calculus 1'],
    ['MC 110', 'Mass Communication in Society'], ['CIS 101', 'Intro to Computing Systems'], ['CIS 104', 'Intro to Word Processing'],
  ] },
  { term: 'Spring 2015', date: '2015-01', courses: [
    ['CHM 210', 'Chemistry 1'], ['ECE 115', 'New Student Design Project'], ['ECE 241', 'Intro to Computer Engineering'],
    ['ECON 110', 'Macroeconomics'], ['MATH 221', 'Calculus 2'],
  ] },
  { term: 'Summer 2015', date: '2015-06', courses: [['PHYS 213', 'Engineering Physics 1']] },
  { term: 'Fall 2015', date: '2015-08', courses: [
    ['CIS 200', 'Programming Fundamentals'], ['ECE 410', 'Circuit Theory 1'], ['GEOL 100', 'Earth in Action'],
    ['MATH 240', 'Differential Equations'],
  ] },
  { term: 'Spring 2016', date: '2016-01', courses: [
    ['CIS 300', 'Data & Program Structures'], ['ECE 441', 'Design of Digital Systems'], ['ECE 511', 'Circuit Theory 2'],
    ['STAT 510', 'Probability & Statistics'], ['COMM 106', 'Public Speaking'],
  ] },
  { term: 'Fall 2016', date: '2016-08', honors: true, courses: [
    ['ECE 431', 'Microcontrollers'], ['ECE 525', 'Electronics 1'], ['ENTRP 340', 'Entrepreneurship'],
    ['MANGT 420', 'Management Concepts'],
  ] },
  { term: 'Spring 2017', date: '2017-01', honors: true, courses: [
    ['CIS 308', 'C/C++ Language Lab'], ['CIS 501', 'Software Architecture & Design'], ['ECE 540', 'Applied Scientific Computing'],
    ['GEOL 125', 'Natural Disasters'], ['MATH 510', 'Discrete Mathematics'],
  ] },
  { term: 'Fall 2017', date: '2017-08', honors: true, courses: [
    ['ECE 542', 'Computer Networking'], ['ECE 643', 'Computer Engineering Design Lab'], ['ECE 649', 'Computer Design 1'],
    ['ENGL 415', 'Written Communication for Engineers'],
  ] },
  { term: 'Spring 2018', date: '2018-01', honors: true, courses: [
    ['CIS 520', 'Operating Systems'], ['ECE 512', 'Linear Systems'], ['ECE 590', 'Senior Design 1'],
    ['ECE 631', 'Microcomputer System Design'], ['ECE 645', 'Digital Electronics'], ['COMM 332', 'Communication & Technology'],
  ] },
  { term: 'Summer 2018', date: '2018-06', courses: [['ECE 690', 'Problems in Electrical Engineering']] },
  { term: 'Fall 2018', date: '2018-08', courses: [
    ['ARCH 301', 'Appreciation of Architecture'], ['CIS 115', 'Intro to Computing Science'], ['CIS 301', 'Logical Foundations of Programming'],
    ['ECE 557', 'Electromagnetic Theory'], ['ECE 591', 'Senior Design 2'],
  ] },
];

// Roles on the timeline highway. `slot` 0 is the main road; other slots are
// parallel roads that branch off at `start` and merge back at `end`.
// Obstacles may carry a date ('YYYY-MM'); undated ones spread across the role.
export const NOW = '2026-09';
export const TIMELINE_START = '2014-07';

export const sections = [
  {
    id: 'ksu', slot: 0, kind: 'campus', landmark: 'campus', start: '2014-08', end: '2018-12', years: '2014–2018',
    company: 'Kansas State University', place: 'Manhattan, KS',
    title: 'B.S. Computer Engineering, minor in Computer Science',
    blurb: 'Every course is a cone at its semester gate, on the date I took it.',
    obstacles: [
      ['Hack K-State', 'Won Hack K-State (2017).', '2017-02'],
      ['IEEE president', 'President of the IEEE student chapter (2018).', '2018-01'],
      ['Graduated', 'Graduated with a B.S. in Computer Engineering and a minor in Computer Science.', '2018-11'],
    ],
  },
  {
    id: 'collegian', slot: 1, landmark: 'press', start: '2015-11', end: '2018-12', years: '2015–2018',
    company: 'Collegian Media Group', place: 'Manhattan, KS',
    title: 'IT Specialist, then IT Support Manager',
    blurb: 'Ran IT for the student newspaper while in school.',
    obstacles: [
      ['100 Macs', 'Kept a network of about 100 Mac workstations running for 65+ faculty, staff, and students.', '2016-02'],
      ['kstatecollegian.com', 'Redesigned and ran kstatecollegian.com, including traffic management.', '2016-08'],
      ['Promoted', 'Promoted to IT Support Manager.', '2017-03'],
      ['Tech of the Year', 'Named Tech of the Year (2017).', '2017-06'],
      ['Hired a team', 'Interviewed, hired, and led the IT support staff.', '2017-11'],
    ],
  },
  {
    id: 'softek', slot: -1, landmark: 'office', start: '2018-05', end: '2018-08', years: '2018',
    company: 'Softek Illuminate', place: 'Overland Park, KS',
    title: 'Software Engineering Intern',
    blurb: 'Summer internship on the Insight application.',
    obstacles: [
      ['Export / import', 'Built export and import components for the Insight application.'],
      ['French l10n', 'Added French localization to the Insight UI.'],
      ['Bug bash', 'Found and fixed bugs across the app to improve reliability.'],
    ],
  },
  {
    id: 'cerner', slot: 0, landmark: 'cerner', start: '2019-01', end: '2020-09', years: '2019–2020',
    company: 'Cerner Corporation', place: 'Kansas City, MO',
    title: 'Software Engineer',
    blurb: 'Patient flow and hospital capacity software on the CareAware platform.',
    obstacles: [
      ['Capacity Mgmt', 'Led development of CareAware Capacity Management for patient flow and tracking.'],
      ['Command Center', 'Planned and built the CareAware Command Center Dashboard for real-time hospital operations.'],
      ['ML census model', 'Integrated an inpatient-census prediction model with the ML team to improve bed utilization.'],
      ['New Relic', 'Added New Relic monitoring and tracing, cutting time to resolve production issues.'],
      ['K8s + Spinnaker', 'Shipped cloud services as Docker containers through Kubernetes and Spinnaker pipelines.'],
      ['Mentored 8', 'Mentored 8 engineers through DevAcademy, Cerner’s software boot camp.'],
      ['Night on the Town', 'Won the Night on the Town award for team collaboration.', '2019-10', 'award'],
    ],
  },
  {
    id: 'rxss', slot: 0, landmark: 'rxss', start: '2020-09', end: '2025-12', years: '2020–2025',
    company: 'Rx Savings Solutions / McKesson', place: 'Overland Park, KS',
    title: 'Software Engineer → Senior Software Engineer & Technical Lead',
    blurb: 'Prescription savings software. McKesson acquired RxSS in November 2022.',
    obstacles: [
      ['Health plan viz', 'Built health plan data visualizations for the pharmacy support team.'],
      ['Nightly scans', 'Automated nightly scans to detect data changes and alert administrators.'],
      ['S3 + CloudFront CMS', 'Built a content management system on AWS S3 and CloudFront.'],
      ['Terraform', 'Introduced Terraform so application stacks deploy the same way in every environment.'],
      ['Azure AD SSO', 'Integrated Azure AD single sign-on.'],
      ['Hackathon 2nd', 'Took 2nd place at the RxSS Hackathon with prescriber fax automation.', '2022-04', 'award'],
      ['Wolverine Award', 'Won the peer-nominated Wolverine Award.', '2022-07', 'award'],
      ['Promoted', 'Promoted to Senior Software Engineer and Technical Lead.', '2022-09'],
      ['Private Label Mgr', 'Shipped Private Label Manager, saving an estimated 2,000 engineering hours.'],
      ['Unified Auth', 'Architected unified auth on Auth0 across the Member Portal, AdminRx, and mobile.'],
      ['MFA rollout', 'Designed MFA enrollment with feature-flagged rollout by user group.'],
      ['Zero downtime', 'Led a zero-downtime migration off legacy auth, with self-service password reset.'],
      ['FLL mentor', 'Mentored the ICJC Mavericks First Lego League team.', '2023-02', 'award'],
      ['Dev Academy', 'Founded and led Dev Academy, training new engineers in PHP and JavaScript.'],
      ['HackMidwest 3rd', 'HackMidwest 2023: CareCue, a chatbot for caregivers. 3rd place.', '2023-10', 'award'],
      ['GitLab move', 'Moved Bitbucket to GitLab and rebuilt CI/CD and Terraform to cut deploy times.'],
      ['Vue 2 → 3', 'Led the Vue 2 to Vue 3 modernization.'],
      ['Spotlight Award', 'Employee Spotlight Award for a technical talk at the CoverMyMeds conference.', '2024-04', 'award'],
      ['HackMidwest 1st', 'HackMidwest 2024: Taini, a voice AI accountability coach. 1st place, Best in AI from AWS.', '2024-10', 'award'],
      ['Demo mode', 'Built a MirageJS demo mode so sales could run custom demos.'],
    ],
  },
  {
    id: 'fluxpilot', slot: 1, landmark: 'bess', start: '2022-06', end: 'now', years: '2022–now',
    company: 'Fluxpilot', place: 'Chicago, IL',
    title: 'Co-Founder',
    blurb: 'Software that sizes and lays out utility-scale battery energy storage projects.',
    obstacles: [
      ['BESS sizing', 'Built the battery energy storage sizing framework.'],
      ['Electron app', 'Built the Electron desktop app and its release process.'],
      ['Local-first', 'Kept project data on the user’s machine by running the desktop app locally.'],
      ['AI sizing tools', 'Shipped a serverless web app with AI-assisted sizing tools.'],
      ['Faster bids', 'Made design iterations faster and repeatable, cutting engineering effort during bids.'],
    ],
  },
  {
    id: 'annovox', slot: -1, landmark: 'factory', start: '2024-06', end: 'now', years: '2024–now',
    company: 'Annovox AI', place: 'St. Joseph, MO',
    title: 'Chief Technology Officer',
    blurb: 'Turns expert video recordings into factory-floor training.',
    obstacles: [
      ['AI work orders', 'Generated editing work orders from subject-matter-expert feedback with OpenAI.'],
      ['MediaConvert', 'Automated video processing and editor assignment with AWS MediaConvert.'],
      ['QR access', 'Gave factory workers QR-code access to training.'],
      ['Offline streaming', 'Delivered adaptive streaming with offline viewing for industrial networks.'],
      ['5-role RBAC', 'Built multi-tenant access control for five user types, with audit trails.'],
    ],
  },
  {
    id: 'nac', slot: 2, landmark: 'capitol', start: '2025-04', end: '2025-12', years: '2025',
    company: 'National Accreditation Commission', place: 'Remote, for the State of Arkansas',
    title: 'Interim Chief Technology Officer',
    blurb: 'An AI compliance platform for workforce Pell grants and institution accreditation.',
    obstacles: [
      ['Graph RAG', 'Built hybrid Graph RAG verification that cut manual review time by 75%.'],
      ['90% accuracy', 'Reached 90% compliance-detection accuracy.'],
      ['15-min checks', 'Designed event-driven serverless processing for 15-minute asynchronous compliance checks.'],
      ['Governor’s office', 'Worked with the Chief Data Officer for the Office of the Governor of Arkansas.'],
      ['OpenAI HQ', 'Presented at OpenAI × GitLab Foundation Demo Day at OpenAI headquarters in San Francisco.', null, 'award'],
      ['Mentored 4', 'Mentored 4 George Washington University master’s students in AI and RAG.'],
    ],
  },
  {
    id: 'addi', slot: -2, landmark: 'billboards', start: '2025-10', end: '2026-06', years: '2025–2026',
    company: 'Addi', place: 'Kansas City, remote',
    title: 'Senior Software Engineer (contract)',
    blurb: 'Tools for small businesses to manage and publish AI-generated ad campaigns.',
    obstacles: [
      ['Campaign UI', 'Built the Addi interface for managing AI-generated ad campaigns.'],
      ['Meta Ads', 'Built the Meta Ads publishing integration.'],
      ['TikTok Ads', 'Built the TikTok Ads publishing integration.'],
      ['Google + YouTube', 'Built the Google Ads and YouTube Ads integrations.'],
      ['Spotify Ads', 'Built the Spotify Ads integration.'],
    ],
  },
  {
    id: 'oneimaging', slot: 0, landmark: 'imaging', start: '2026-01', end: 'now', years: '2026–now',
    company: 'OneImaging', place: 'Remote',
    title: 'Staff Software Engineer',
    blurb: 'Patient imaging scheduling and care coordination.',
    obstacles: [
      ['OI Investigator', 'Shipped OI Investigator, a HIPAA-scoped AI agent (Claude on Bedrock, ECS Fargate) that root-causes support tickets.'],
      ['200+ tickets', 'OI Investigator triaged 200+ tickets in its first two months.'],
      ['800+ hours', 'Saved an estimated 800+ engineering hours of manual investigation.'],
      ['RIS integration', 'Led the AdvancedMD RIS integration for real-time, multi-facility availability.'],
      ['Jumpstart', 'Delivered Jumpstart, fast-path booking against pending orders.'],
      ['Playwright gate', 'Built the first Playwright end-to-end suite as a blocking pre-merge gate.'],
      ['Flyway migrations', 'Architected Flyway migrations with unsafe-DDL linting and drift detection.'],
      ['Support rotation', 'Set up the engineering support rotation and triage process.'],
      ['Flags + analytics', 'Added feature flags and improved product analytics in Amplitude.'],
      ['Fax callbacks', 'Reworked the fax integration to use callbacks for faster sending and receiving.'],
      ['Agentic harness', 'Building an agentic development harness with automated end-to-end checks.'],
    ],
  },
];

// The road ends in Chicago, where every branch merges.
export const finish = {
  id: 'chicago', landmark: 'chicago', company: 'Chicago, IL', place: 'Home base', years: 'Now',
  title: 'Where the road is today', blurb: 'Every road merges here. Thanks for driving.',
};

export const skills = [
  ['AI / ML', 'Amazon Bedrock, Claude, OpenAI, AI agents, LangChain, Graph RAG, Neo4j, Pinecone, guardrails, evals'],
  ['Healthcare', 'HL7, X12 EDI (837/270/271/835), AdvancedMD RIS, HIPAA'],
  ['Cloud', 'AWS, ECS Fargate, Lambda, EventBridge, Serverless, SST, Terraform'],
  ['Backend', 'Node.js, PHP, Python, FastAPI, Express, Spring Boot, Java'],
  ['Frontend', 'React, Vue 3, TypeScript, Electron, PWAs'],
  ['Data', 'Aurora PostgreSQL, MySQL, MongoDB, DynamoDB, Redis, Flyway'],
  ['Delivery', 'GitHub Actions, GitLab CI, Docker, Kubernetes, Playwright, Testcontainers'],
  ['Security', 'Auth0, OAuth 2.0, SAML, Azure AD, Cognito, MFA, WAF'],
];
