// Single source of truth for the 15 seeded lessons + the categories they use.
const lessons = [...require("./lessons.part1"), ...require("./lessons.part2")];

const categories = [
  { name: "Web Development", color: "#6366F1", icon: "code", description: "HTML, CSS, JavaScript, React, REST and Node.js." },
  { name: "Databases", color: "#06B6D4", icon: "database", description: "MongoDB and SQL fundamentals." },
  { name: "Programming", color: "#84CC16", icon: "terminal", description: "Data structures, algorithms and complexity." },
  { name: "Operating Systems", color: "#F59E0B", icon: "cpu", description: "Processes, threads and how the OS schedules work." },
  { name: "Networking", color: "#10B981", icon: "network", description: "How data moves across networks." },
  { name: "Cybersecurity", color: "#EF4444", icon: "shield", description: "Authentication and common web attacks." },
  { name: "Cloud Computing", color: "#38BDF8", icon: "cloud", description: "Cloud service models and concepts." },
  { name: "DevOps", color: "#A78BFA", icon: "git-branch", description: "Git, workflows and delivery." },
  { name: "Artificial Intelligence", color: "#8B5CF6", icon: "brain", description: "AI and large language models." },
];

module.exports = { lessons, categories };
