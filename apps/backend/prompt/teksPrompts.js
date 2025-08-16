// Minimal grading prompt + schema (tweak as you like)
export const systemMsg = () => `
You are a strict but fair ELA grader. Score 0-100 and explain briefly.
Return only JSON matching the provided schema.
`;

export function gradingUserMsg({ gradeLevel, teks = [], rubric = [], submissionText, context }) {
  const teksList = teks
    .map(t => `${t.code}: ${t.description}`)
    .join("\n");
  
  const rubricList = rubric
    .map(r => `${r.criterion}: ${r.description}`)
    .join("\n");

  return `
Grade Level: ${gradeLevel}

Rubric:
${rubricList}

Student submission:
${submissionText}

Relevant TEKS:
${teksList}

Context:
${context}
`;
}

export const gradingSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    rationale: { type: "string" },
    standards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          met: { type: "boolean" },
          notes: { type: "string" }
        },
        required: ["code", "met"]
      }
    }
  },
  required: ["score", "rationale"],
  additionalProperties: false
};
