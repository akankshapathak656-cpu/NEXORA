// Built-in fictional sample candidates with realistic full-resume text (Education, dated Experience
// with quantified bullets, categorized Skills, Projects) to showcase strong, mid-tier, hidden-fit,
// and weak candidates across all built-in roles.
export const SAMPLE_CANDIDATES = [
  {
    id: 0,
    real: 'Rahul Sharma',
    n: 'Rahul Sharma',
    r: 'Frontend Developer',
    st: 'Shortlisted',
    sk: ['React', 'JavaScript', 'TypeScript', 'CSS', 'Git', 'REST APIs', 'Testing', 'Accessibility'],
    ex: '3 yrs',
    ed: 'B.Tech CS',
    pr: 'E-commerce storefront (React, TypeScript, Jest) and WCAG-compliant design-system library',
    em: 'rahul.sharma@example.com',
    ph: '+91-98100-11223',
    wk: [
      'Senior Frontend Engineer, CartPulse Commerce (Jul 2023 – Present): Built React + TypeScript storefront with REST APIs, WCAG 2.1 AA accessibility, and Jest/RTL test suite (88% coverage).',
      'Frontend Developer, PixelGrid Labs (Jun 2022 – Jun 2023): Shipped reusable CSS/React design-system library across 4 products using Git PR workflows.',
    ],
    resumeText: `Rahul Sharma
+91-98100-11223 | rahul.sharma@example.com | Bengaluru, IN

EDUCATION
National Institute of Engineering, Bengaluru — 8.7 CGPA
B.Tech in Computer Science and Engineering (2018 – 2022)

EXPERIENCE
Senior Frontend Engineer — CartPulse Commerce (July 2023 – Present)
- Architected modular checkout and catalog views in React, TypeScript, and modern CSS, improving Lighthouse performance scores by 34%.
- Integrated 20+ REST APIs with optimistic caching and error boundaries, cutting user-facing checkout errors by 41%.
- Implemented WCAG 2.1 AA Accessibility (keyboard navigation, ARIA landmarks, focus traps) and maintained 88% unit/integration test coverage using Jest and React Testing Library.
- Led Git code reviews and CI/CD pipelines for a 5-person frontend squad.
Tags: React, TypeScript, JavaScript, CSS, REST APIs, Accessibility, Testing, Git, CI/CD

Frontend Developer — PixelGrid Labs (June 2022 – June 2023)
- Built a reusable React and CSS design-system library adopted by 4 internal web applications.
- Refactored legacy JavaScript bundles to TypeScript, reducing runtime type defects by 52%.
Tags: React, JavaScript, TypeScript, CSS, Git, Tailwind CSS

SKILLS
- Languages: JavaScript, TypeScript, HTML, CSS
- Frameworks: React, Next.js, Tailwind CSS, Jest, React Testing Library
- Tools: Git, GitHub Actions, Figma, Webpack, Vite
- Concepts: REST APIs, Accessibility (WCAG 2.1), Testing, Responsive Design, CI/CD

PROJECTS
CartPulse Design System — Accessible component library
- Built 35+ accessible React/TypeScript components with automated Jest + axe-core testing and Storybook docs.
- Reduced new feature UI assembly time by 40% across product teams.
Tags: React, TypeScript, CSS, Accessibility, Testing, Git`,
  },
  {
    id: 1,
    real: 'Ananya Verma',
    n: 'Ananya Verma',
    r: 'UI Developer',
    st: 'Review',
    sk: ['HTML', 'CSS', 'JavaScript', 'React', 'Accessibility', 'Figma', 'Git'],
    ex: '2 yrs',
    ed: 'BCA',
    pr: 'Accessible component kit and Figma-to-React token pipeline',
    em: 'ananya.verma@example.com',
    ph: '+91-98201-33445',
    wk: [
      'UI Developer, CraftStudio Digital (Aug 2024 – Present): Converted Figma design systems into accessible HTML/CSS/React components with full WCAG AA compliance.',
      'Junior UI Engineer, BrightLeaf Web (Jul 2023 – Jul 2024): Built responsive marketing and SaaS layouts using HTML, CSS, JavaScript, and Git.',
    ],
    resumeText: `Ananya Verma
+91-98201-33445 | ananya.verma@example.com | Pune, IN

EDUCATION
Symbiosis Institute of Computer Studies, Pune — 8.4 CGPA
Bachelor of Computer Applications (BCA), 2020 – 2023

EXPERIENCE
UI Developer — CraftStudio Digital (August 2024 – Present)
- Translated 40+ Figma prototypes into responsive, accessible React, HTML, and CSS components.
- Audited enterprise dashboards for WCAG 2.1 AA Accessibility, fixing keyboard-trap and contrast defects across 18 screens.
- Collaborated with design leads using Figma tokens and Git branch reviews.
Tags: Figma, HTML, CSS, JavaScript, React, Accessibility, Git

Junior UI Engineer — BrightLeaf Web (July 2023 – July 2024)
- Built responsive SaaS landing pages and interactive pricing calculators in HTML, CSS, and JavaScript.
- Improved mobile layout responsiveness and reduced CSS bundle size by 28%.
Tags: HTML, CSS, JavaScript, Responsive Design, Git

SKILLS
- Languages: HTML, CSS, JavaScript
- Frameworks: React, Tailwind CSS
- Tools: Figma, Git, Storybook, Chrome DevTools
- Concepts: Accessibility (WCAG), Responsive Design, Design Systems

PROJECTS
A11yKit — Accessible UI Component Library
- Engineered 24 WCAG-compliant React + CSS primitives (modals, tabs, comboboxes) directly from Figma specs.
Tags: React, HTML, CSS, Accessibility, Figma`,
  },
  {
    id: 2,
    real: 'Karan Mehta',
    n: 'Karan Mehta',
    r: 'Full Stack Developer',
    st: 'Review',
    sk: ['JavaScript', 'React', 'Node.js', 'REST APIs', 'Git', 'PostgreSQL'],
    ex: '3 yrs',
    ed: 'B.Tech IT',
    pr: 'MERN job board and Node.js REST microservice gateway',
    em: 'karan.mehta@example.com',
    ph: '+91-98302-55667',
    wk: [
      'Full Stack Engineer, HireFlow Systems (May 2023 – Present): Built React frontend and Node.js REST APIs backed by PostgreSQL using Git workflows.',
      'Software Engineer, CloudNest Apps (Jun 2022 – Apr 2023): Developed customer portals in React, JavaScript, and Express REST APIs.',
    ],
    resumeText: `Karan Mehta
+91-98302-55667 | karan.mehta@example.com | Hyderabad, IN

EDUCATION
Osmania College of Engineering, Hyderabad — 8.1 CGPA
B.Tech in Information Technology (2018 – 2022)

EXPERIENCE
Full Stack Engineer — HireFlow Systems (May 2023 – Present)
- Built candidate and recruiter dashboards using React, JavaScript, and Node.js REST APIs serving 15k monthly users.
- Designed PostgreSQL schemas and optimized query latency by 38% on search endpoints.
- Managed releases and code reviews using Git and Docker.
Tags: React, JavaScript, Node.js, REST APIs, PostgreSQL, Git, Docker

Software Engineer — CloudNest Apps (June 2022 – April 2023)
- Developed customer billing portals with React, CSS, and Express REST APIs.
- Integrated third-party webhooks and automated deployment scripts.
Tags: React, JavaScript, CSS, Node.js, REST APIs, Git

SKILLS
- Languages: JavaScript, SQL, HTML, CSS
- Frameworks: React, Node.js, Express
- Tools: Git, Docker, PostgreSQL, Postman
- Concepts: REST APIs, Full-Stack Development

PROJECTS
MERN Job Board — Multi-tenant hiring portal
- Built end-to-end React + Node.js REST application with JWT auth, saved searches, and real-time notifications.
Tags: React, JavaScript, Node.js, REST APIs, Git`,
  },
  {
    id: 3,
    real: 'Priya Nair',
    n: 'Priya Nair',
    r: 'Web Designer',
    st: 'Hired',
    sk: ['HTML', 'CSS', 'JavaScript', 'Figma', 'Git'],
    ex: '1 yr',
    ed: 'BCA',
    pr: 'Responsive brand portfolio sites and Figma wireframes',
    em: 'priya.nair@example.com',
    ph: '+91-98403-77889',
    wk: [
      'Junior Web Designer, StudioKochi (Aug 2025 – Present): Designed Figma wireframes and built responsive HTML/CSS/JavaScript brochure sites.',
    ],
    resumeText: `Priya Nair
+91-98403-77889 | priya.nair@example.com | Kochi, IN

EDUCATION
Cochin University of Science & Technology — 8.0 CGPA
Bachelor of Computer Applications (BCA), 2022 – 2025

EXPERIENCE
Junior Web Designer — StudioKochi (August 2025 – Present)
- Designed responsive wireframes in Figma and coded static marketing pages using HTML, CSS, and vanilla JavaScript.
- Used Git for version control and Netlify for static site deployments.
Tags: Figma, HTML, CSS, JavaScript, Git

SKILLS
- Languages: HTML, CSS, JavaScript
- Tools: Figma, Git, Canva

PROJECTS
Boutique Portfolio Collection
- Built 6 mobile-friendly portfolio websites using semantic HTML, CSS Grid, and lightweight JavaScript animations.
Tags: HTML, CSS, JavaScript, Figma`,
  },
  {
    id: 4,
    real: 'Aarav Singh',
    n: 'Aarav Singh',
    r: 'Frontend Developer',
    st: 'New',
    sk: ['Vue', 'JavaScript', 'CSS', 'REST APIs', 'Git'],
    ex: '2 yrs',
    ed: 'B.Sc CS',
    pr: 'Vue 3 e-commerce storefront with REST API checkout',
    em: 'aarav.singh@example.com',
    ph: '+91-98504-99001',
    wk: [
      'Frontend Developer, ShopWave Retail (Sep 2024 – Present): Built Vue 3 + JavaScript storefront integrated with REST APIs and CSS modules.',
      'Frontend Intern, WebCraft India (Jan 2024 – Aug 2024): Implemented responsive product pages in Vue, CSS, and Git.',
    ],
    resumeText: `Aarav Singh
+91-98504-99001 | aarav.singh@example.com | Noida, IN

EDUCATION
Delhi University — 7.9 CGPA
B.Sc in Computer Science (2021 – 2024)

EXPERIENCE
Frontend Developer — ShopWave Retail (September 2024 – Present)
- Developed Vue 3 single-page storefront flows in JavaScript and CSS, connecting to catalog and cart REST APIs.
- Reduced page load time by 25% via route-level code splitting and image lazy-loading.
Tags: Vue, JavaScript, CSS, REST APIs, Git

Frontend Intern — WebCraft India (January 2024 – August 2024)
- Created responsive product listing pages in Vue, HTML, and CSS using Git workflows.
Tags: Vue, HTML, CSS, Git

SKILLS
- Languages: JavaScript, HTML, CSS
- Frameworks: Vue, Nuxt.js
- Tools: Git, Vite, Postman
- Concepts: REST APIs, Responsive Design

PROJECTS
Vue Storefront — Multi-currency retail SPA
- Built product filtering, cart state management, and REST API integration in Vue 3 and JavaScript.
Tags: Vue, JavaScript, CSS, REST APIs`,
  },
  {
    id: 5,
    real: 'Sneha Iyer',
    n: 'Sneha Iyer',
    r: 'Backend Developer',
    st: 'New',
    sk: ['Python', 'Flask', 'FastAPI', 'Node.js', 'REST APIs', 'Git', 'Testing', 'PostgreSQL', 'Docker'],
    ex: '3 yrs',
    ed: 'MCA',
    pr: 'High-throughput Flask inventory API and Node.js webhook processor with Pytest',
    em: 'sneha.iyer@example.com',
    ph: '+91-98605-22334',
    wk: [
      'Backend Engineer, LogiTrack Systems (Jul 2023 – Present): Architected Python/Flask and Node.js REST APIs with PostgreSQL, Docker, and 92% automated Pytest coverage.',
      'Python Developer, FinLedger Tech (Jun 2022 – Jun 2023): Built reconciliation microservices in Python, Flask, REST APIs, and Git CI/CD.',
    ],
    resumeText: `Sneha Iyer
+91-98605-22334 | sneha.iyer@example.com | Chennai, IN

EDUCATION
Anna University, Chennai — 8.9 CGPA
Master of Computer Applications (MCA), 2020 – 2022

EXPERIENCE
Backend Engineer — LogiTrack Systems (July 2023 – Present)
- Designed and scaled Python (Flask & FastAPI) and Node.js REST APIs handling 120k daily shipment events.
- Optimized PostgreSQL indexing and connection pooling, cutting p95 API latency by 46%.
- Maintained 92% automated unit and integration Testing coverage with Pytest and Jest; containerized services with Docker and Git CI/CD.
Tags: Python, Flask, FastAPI, Node.js, REST APIs, PostgreSQL, Testing, Docker, Git, CI/CD

Python Developer — FinLedger Tech (June 2022 – June 2023)
- Built automated settlement REST APIs using Python, Flask, and SQLAlchemy with comprehensive Pytest suites.
Tags: Python, Flask, REST APIs, Testing, Git

SKILLS
- Languages: Python, JavaScript, SQL, Bash
- Frameworks: Flask, FastAPI, Node.js, Express, Pytest
- Tools: Git, Docker, PostgreSQL, Redis, GitHub Actions
- Concepts: REST APIs, Automated Testing, Microservices, CI/CD

PROJECTS
Flask Inventory & Order API
- Engineered a multi-warehouse REST API in Python/Flask with idempotent webhooks, Docker Compose setup, and 85+ Pytest integration tests.
Tags: Python, Flask, REST APIs, Testing, Docker, PostgreSQL`,
  },
  {
    id: 6,
    real: 'Dev Patel',
    n: 'Dev Patel',
    r: 'Frontend Developer',
    st: 'Rejected',
    sk: ['HTML', 'CSS', 'JavaScript'],
    ex: 'Fresher',
    ed: 'BCA',
    pr: 'Static college event landing pages',
    em: 'dev.patel@example.com',
    ph: '+91-98706-44556',
    wk: [],
    resumeText: `Dev Patel
+91-98706-44556 | dev.patel@example.com | Ahmedabad, IN

EDUCATION
Gujarat University — 7.2 CGPA
Bachelor of Computer Applications (BCA), 2023 – 2026

EXPERIENCE
Fresher — No professional work experience yet.

SKILLS
- Languages: HTML, CSS, JavaScript

PROJECTS
College Tech Fest Landing Page
- Built a static multi-section event website using HTML, CSS, and basic JavaScript form validation.
Tags: HTML, CSS, JavaScript`,
  },
  {
    id: 7,
    real: 'Meera Joshi',
    n: 'Meera Joshi',
    r: 'Web Designer',
    st: 'New',
    sk: ['Figma', 'CSS', 'HTML', 'Accessibility'],
    ex: '2 yrs',
    ed: 'B.Des',
    pr: 'Enterprise design system and WCAG color/typography audit in Figma',
    em: 'meera.joshi@example.com',
    ph: '+91-98807-66778',
    wk: [
      'UI/Visual Designer, Veloce Health (Jun 2024 – Present): Created Figma component systems, WCAG Accessibility audits, and HTML/CSS prototypes.',
    ],
    resumeText: `Meera Joshi
+91-98807-66778 | meera.joshi@example.com | Mumbai, IN

EDUCATION
MIT Institute of Design, Pune — 8.6 CGPA
Bachelor of Design (B.Des) in User Experience (2020 – 2024)

EXPERIENCE
UI Designer — Veloce Health (June 2024 – Present)
- Designed a 50-component Figma design system with documented WCAG 2.1 Accessibility contrast and focus states.
- Built interactive HTML and CSS prototypes to hand off responsive layouts to engineering teams.
Tags: Figma, HTML, CSS, Accessibility

SKILLS
- Design & Frontend: Figma, HTML, CSS, Accessibility, Responsive Design

PROJECTS
Healthcare Design System
- Created token-driven Figma library and semantic HTML/CSS style guide for patient portals.
Tags: Figma, CSS, HTML, Accessibility`,
  },
  {
    id: 8,
    real: 'Riya Sharma',
    n: 'Riya Sharma',
    r: 'SDE',
    st: 'Shortlisted',
    sk: ['React', 'JavaScript', 'TypeScript', 'CSS', 'REST APIs', 'Git', 'Testing', 'Python'],
    ex: '2.5 yrs',
    ed: 'B.Tech CS',
    pr: 'Campus placement portal (React, TypeScript, REST APIs, Jest)',
    em: 'riya.sharma@example.com',
    ph: '+91-98908-88990',
    wk: [
      'Software Development Engineer, EduBridge Cloud (Jan 2024 – Present): Built React + TypeScript student portals consuming REST APIs with Jest/Playwright Testing and Git CI.',
      'Software Engineer Intern, DevSpark Labs (Jun 2023 – Dec 2023): Developed reusable React UI modules and automated frontend tests.',
    ],
    resumeText: `Riya Sharma
+91-98908-88990 | riya.sharma@example.com | Bengaluru, IN

EDUCATION
VIT Vellore — 8.8 CGPA
B.Tech in Computer Science and Engineering (2019 – 2023)

EXPERIENCE
Software Development Engineer — EduBridge Cloud (January 2024 – Present)
- Engineered React, TypeScript, and CSS workflows for an assessment portal serving 30k+ students.
- Consumed and documented 15+ REST APIs with typed clients, cutting frontend integration bugs by 35%.
- Authored 120+ automated Jest and Playwright tests in Git CI/CD pipelines.
Tags: React, TypeScript, JavaScript, CSS, REST APIs, Testing, Git, CI/CD

Software Engineer Intern — DevSpark Labs (June 2023 – December 2023)
- Implemented responsive React components and REST API forms using JavaScript and Git.
Tags: React, JavaScript, CSS, REST APIs, Git

SKILLS
- Languages: TypeScript, JavaScript, Python, HTML, CSS
- Frameworks: React, Next.js, Jest, Playwright
- Tools: Git, GitHub Actions, Docker
- Concepts: REST APIs, Testing, Responsive Design

PROJECTS
Campus Placement Portal
- Built role-based recruiter and student web app in React, TypeScript, and REST APIs with automated Jest test suites.
Tags: React, TypeScript, REST APIs, Testing, Git`,
  },
  {
    id: 9,
    real: 'Aarav Mehta',
    n: 'Aarav Mehta',
    r: 'SDE',
    st: 'Interview',
    sk: ['React', 'JavaScript', 'CSS', 'Git', 'REST APIs', 'Accessibility', 'Node.js'],
    ex: '1.5 yrs',
    ed: 'B.Tech IT',
    pr: 'Accessible interview scheduling app (React, REST APIs, ARIA)',
    em: 'aarav.mehta@example.com',
    ph: '+91-98119-00112',
    wk: [
      'Associate SDE, Calendryx Tech (May 2025 – Present): Built accessible React + JavaScript scheduling views connected to Node.js REST APIs.',
    ],
    resumeText: `Aarav Mehta
+91-98119-00112 | aarav.mehta@example.com | Gurugram, IN

EDUCATION
IIIT Allahabad — 8.3 CGPA
B.Tech in Information Technology (2021 – 2025)

EXPERIENCE
Associate Software Engineer — Calendryx Tech (May 2025 – Present)
- Developed React, JavaScript, and CSS calendar views integrating with Node.js REST APIs.
- Implemented keyboard navigation and ARIA Accessibility attributes across time-slot pickers.
- Collaborated via Git feature branches and PR reviews.
Tags: React, JavaScript, CSS, REST APIs, Accessibility, Node.js, Git

SKILLS
- Languages: JavaScript, HTML, CSS
- Frameworks: React, Node.js
- Tools: Git, Postman
- Concepts: REST APIs, Accessibility

PROJECTS
Interview Scheduling App
- Built an accessible React + Node.js REST scheduling app with timezone handling and keyboard-first date pickers.
Tags: React, JavaScript, CSS, REST APIs, Accessibility`,
  },
  {
    id: 10,
    real: 'Sneha Patel',
    n: 'Sneha Patel',
    r: 'SDE',
    st: 'Shortlisted',
    sk: ['JavaScript', 'TypeScript', 'CSS', 'Git', 'REST APIs', 'Testing', 'Python', 'Flask'],
    ex: '2 yrs',
    ed: 'B.Tech CS',
    pr: 'Real-time analytics dashboard (TypeScript, REST APIs, Flask, Pytest)',
    em: 'sneha.patel@example.com',
    ph: '+91-98220-33441',
    wk: [
      'Software Engineer, MetricPulse Analytics (Jul 2024 – Present): Built TypeScript/JavaScript analytics UI and Python/Flask REST APIs with automated Testing and Git.',
    ],
    resumeText: `Sneha Patel
+91-98220-33441 | sneha.patel@example.com | Bengaluru, IN

EDUCATION
PES University, Bengaluru — 8.5 CGPA
B.Tech in Computer Science (2020 – 2024)

EXPERIENCE
Software Engineer — MetricPulse Analytics (July 2024 – Present)
- Built interactive TypeScript, JavaScript, and CSS data visualization dashboards backed by Python/Flask REST APIs.
- Wrote automated Jest and Pytest Testing suites covering 80%+ of critical API and UI logic, managed via Git.
Tags: TypeScript, JavaScript, CSS, Python, Flask, REST APIs, Testing, Git

SKILLS
- Languages: TypeScript, JavaScript, Python, SQL, CSS
- Frameworks: Flask, Jest, Pytest
- Tools: Git, Docker, PostgreSQL
- Concepts: REST APIs, Testing, Data Visualization

PROJECTS
MetricPulse Real-Time Analytics Dashboard
- Built TypeScript dashboard widgets and Flask REST endpoints with automated API tests.
Tags: TypeScript, JavaScript, Python, Flask, REST APIs, Testing`,
  },
];

// Number of built-in sample candidates.
export const NS = SAMPLE_CANDIDATES.length;
