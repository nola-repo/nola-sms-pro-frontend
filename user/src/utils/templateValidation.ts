const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

const CONTACT_PLACEHOLDERS = [
  "contact.name",
  "contact.first_name",
  "contact.last_name",
  "contact.phone",
  "contact.email",
];

const REQUIRED_PLACEHOLDER_GROUPS = [
  {
    label: "contact",
    examples: ["{{contact.first_name}}", "{{contact.name}}"],
    values: CONTACT_PLACEHOLDERS,
  },
  {
    label: "company",
    examples: ["{{company.name}}"],
    values: ["company.name"],
  },
];

const ALLOWED_PLACEHOLDERS = new Set([
  ...CONTACT_PLACEHOLDERS,
  "company.name",
]);

export type TemplateValidationResult = {
  isValid: boolean;
  missingGroups: Array<{ label: string; examples: string[] }>;
  unknownPlaceholders: string[];
};

export const extractTemplatePlaceholders = (content: string): string[] => {
  const matches = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    matches.add(match[1].trim().toLowerCase());
  }
  return Array.from(matches);
};

export const validateTemplateContent = (content: string): TemplateValidationResult => {
  const placeholders = extractTemplatePlaceholders(content);
  const placeholderSet = new Set(placeholders);

  const missingGroups = REQUIRED_PLACEHOLDER_GROUPS
    .filter((group) => !group.values.some((value) => placeholderSet.has(value)))
    .map(({ label, examples }) => ({ label, examples }));

  const unknownPlaceholders = placeholders.filter((placeholder) => !ALLOWED_PLACEHOLDERS.has(placeholder));

  return {
    isValid: missingGroups.length === 0 && unknownPlaceholders.length === 0,
    missingGroups,
    unknownPlaceholders,
  };
};

export const formatTemplateValidationMessage = (result: TemplateValidationResult): string => {
  const messages: string[] = [];

  if (result.missingGroups.length > 0) {
    messages.push(
      `Add ${result.missingGroups
        .map((group) => `${group.label} placeholder (${group.examples.join(" or ")})`)
        .join(" and ")}.`
    );
  }

  if (result.unknownPlaceholders.length > 0) {
    messages.push(`Remove or replace unsupported placeholder${result.unknownPlaceholders.length === 1 ? "" : "s"}: ${result.unknownPlaceholders.map((value) => `{{${value}}}`).join(", ")}.`);
  }

  return messages.join(" ");
};
