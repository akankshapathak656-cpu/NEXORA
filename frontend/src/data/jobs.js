// Built-in job roles with realistic JD context so all 7 scoring components evaluate cleanly.
export const JOBS = [
  {
    t: 'Frontend Developer',
    req: ['React', 'JavaScript', 'TypeScript', 'CSS', 'REST APIs', 'Git', 'Testing', 'Accessibility'],
    pref: ['Next.js', 'Tailwind CSS', 'CI/CD', 'Performance Optimization'],
    expMin: 2,
    edu: 'Bachelor degree in Computer Science, IT, or equivalent',
    resp: [
      'Build and maintain responsive, accessible React and TypeScript web applications',
      'Integrate frontend views with REST APIs and manage client-side state reliably',
      'Write automated unit and integration tests and participate in Git code reviews',
      'Collaborate with designers to ship reusable UI components with WCAG compliance',
    ],
    d: 'Builds accessible, well-tested React and TypeScript interfaces integrated with REST APIs and reusable design systems.',
  },
  {
    t: 'UI Developer',
    req: ['HTML', 'CSS', 'JavaScript', 'Accessibility', 'Figma', 'React'],
    pref: ['Tailwind CSS', 'Design Systems', 'TypeScript', 'Responsive Design'],
    expMin: 1,
    edu: 'Bachelor degree in Design, Computer Science, or equivalent',
    resp: [
      'Translate Figma prototypes into pixel-accurate, responsive HTML, CSS, and React components',
      'Maintain a shared accessible component library meeting WCAG 2.1 AA standards',
      'Audit and improve visual consistency, keyboard navigation, and cross-browser rendering',
    ],
    d: 'Turns Figma design systems into accessible, responsive, reusable React and CSS components.',
  },
  {
    t: 'Backend Developer',
    req: ['Python', 'Flask', 'REST APIs', 'Node.js', 'Git', 'Testing'],
    pref: ['PostgreSQL', 'Docker', 'FastAPI', 'CI/CD'],
    expMin: 2,
    edu: 'Bachelor degree in Computer Science, Engineering, or equivalent',
    resp: [
      'Design, build, and maintain scalable REST APIs in Python (Flask/FastAPI) or Node.js',
      'Model relational database schemas, optimize slow queries, and ensure API reliability',
      'Write automated API and unit tests and deploy containerized services via Git workflows',
    ],
    d: 'Designs, tests, and maintains scalable Python and Node.js REST services and data pipelines.',
  },
];
