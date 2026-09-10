// Suggested roles, not eligibility restrictions. Custom positions remain
// available for specialist roles and existing jobs.
const positionsByDepartment: Record<string, readonly string[]> = {
  "EEE - Electrical and Electronic Engineering": [
    "Electrical Engineer", "Electronics Engineer", "Power Systems Engineer",
    "Automation Engineer", "Maintenance Engineer", "Quality Assurance Officer",
  ],
  "CSE - Computer Science and Engineering": [
    "Software Engineer", "Junior Software Developer", "Frontend Developer",
    "Backend Developer", "Software QA Engineer", "Data Analyst", "Network Engineer",
  ],
  "ICT - Information and Communication Technology": [
    "IT Support Officer", "Network Engineer", "System Administrator",
    "Software Engineer", "Junior Software Developer", "Cybersecurity Analyst",
  ],
  "Mechanical Engineering": [
    "Mechanical Engineer", "Maintenance Engineer", "Production Engineer",
    "HVAC Engineer", "Mechanical Design Engineer", "Quality Assistant",
  ],
  "Civil Engineering": [
    "Civil Engineer", "Site Engineer", "Structural Engineer",
    "Estimation Engineer", "Quantity Surveyor", "Construction Project Engineer",
  ],
  "IPE - Industrial and Production Engineering": [
    "Industrial Engineer", "Production Engineer", "Process Improvement Engineer",
    "Quality Assistant", "Quality Assurance Officer", "Supply Chain Executive",
  ],
  "Textile Engineering": [
    "Textile Engineer", "Production Engineer", "Quality Assistant",
    "Quality Assurance Officer", "Merchandising Executive", "Junior Merchandising Executive",
  ],
  "Chemical Engineering": [
    "Chemical Engineer", "Process Engineer", "Production Engineer",
    "Quality Control Officer", "Lab Assistant", "Process Safety Engineer",
  ],
  "Architecture": [
    "Architect", "Junior Architect", "Architectural Designer", "Interior Designer", "BIM Modeler",
  ],
  "BBA - Business Administration": [
    "Management Trainee", "HR Executive", "Marketing Executive", "Sales Executive",
    "Accounts Officer", "Supply Chain Executive", "Business Development Executive",
  ],
  "Accounting": [
    "Accountant", "Accounts Officer", "Audit Associate", "Tax Associate", "Finance Executive",
  ],
  "Finance": [
    "Financial Analyst", "Finance Executive", "Accounts Officer", "Credit Analyst", "Bank Management Trainee",
  ],
  "Management": [
    "Management Trainee", "HR Executive", "Operations Executive", "Administrative Officer", "Supply Chain Executive",
  ],
  "Marketing": [
    "Marketing Executive", "Sales Executive", "Digital Marketing Executive",
    "Brand Executive", "Market Research Analyst", "Business Development Executive",
  ],
  "Economics": [
    "Research Assistant", "Economic Research Analyst", "Data Analyst", "Market Research Analyst", "Development Project Officer",
  ],
  "English": [
    "Content Writer", "Copywriter", "English Teacher", "Editorial Assistant", "Communications Officer",
  ],
  "Mathematics": [
    "Data Analyst", "Mathematics Teacher", "Research Assistant", "Actuarial Analyst",
  ],
  "Physics": [
    "Lab Assistant", "Research Assistant", "Physics Teacher", "Instrumentation Officer",
  ],
  "Chemistry": [
    "Chemist", "Lab Assistant", "Quality Control Officer", "Research Assistant", "Chemistry Teacher",
  ],
  "Statistics": [
    "Data Analyst", "Statistical Officer", "Research Assistant", "Survey Analyst", "Biostatistician",
  ],
  "Pharmacy": [
    "Pharmacist", "Production Officer", "Quality Assurance Officer", "Quality Control Officer", "Regulatory Affairs Officer",
  ],
  "Microbiology": [
    "Microbiologist", "Lab Assistant", "Quality Control Officer", "Research Assistant", "Food Safety Officer",
  ],
  "Biochemistry and Molecular Biology": [
    "Biochemist", "Research Assistant", "Lab Assistant", "Quality Control Officer", "Molecular Biology Research Officer",
  ],
  "Law": [
    "Legal Officer", "Legal Research Assistant", "Compliance Officer", "Legal Associate",
  ],
};

export const academicDepartments = Object.keys(positionsByDepartment);

export function getJobPositions(department: string): readonly string[] {
  return Object.hasOwn(positionsByDepartment, department)
    ? positionsByDepartment[department]
    : [];
}
