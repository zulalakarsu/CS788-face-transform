export interface EditParameters {
  bodyType: number; // -1 to 1: thin to heavier
  ageChange: number; // -15 to +20
  preserveClothing: boolean;
  isFullBody: boolean; // true if full-body photo, false if selfie
}

export function buildEditPrompt(params: EditParameters): string {
  const { bodyType, ageChange, preserveClothing, isFullBody } = params;
  
  let prompt = '';
  
  // Base instruction
  if (isFullBody) {
    prompt += 'Edit this existing full-body photo with the following changes: ';
  } else {
    prompt += 'Edit this existing portrait photo with the following changes: ';
  }
  
  // Body type changes
  if (bodyType < -0.3) {
    prompt += 'Make the person noticeably thinner with realistic proportions, ';
  } else if (bodyType > 0.3) {
    prompt += 'Make the person heavier with realistic proportions, ';
  } else if (Math.abs(bodyType) > 0.1) {
    prompt += 'Make the person athletic and muscular with defined arms and torso, realistic proportions, ';
  }
  
  // Age changes
  if (ageChange > 5) {
    prompt += `age the person by approximately ${Math.round(ageChange)} years with subtle wrinkles and mature posture, `;
  } else if (ageChange < -5) {
    prompt += `make the person look approximately ${Math.abs(Math.round(ageChange))} years younger with smoother skin and youthful posture, `;
  }
  
  // Clothing preservation
  if (preserveClothing) {
    prompt += 'preserve the original clothing exactly, ';
  }
  
  // Critical preservation requirements
  prompt += 'Do not crop, stretch, warp, or simply rescale the person to simulate edits, ';
  prompt += 'IMPORTANT: preserve face identity exactly, maintain the same facial features and expression, ';
  prompt += 'keep background and lighting consistent with the original, ';
  prompt += 'maintain the same camera angle and perspective, ';
  prompt += 'ensure photorealistic results, ';
  prompt += 'avoid any distortions or unnatural proportions. ';
  
  // Final quality requirements
  prompt += 'The result should look natural and believable, maintaining the person\'s recognizable identity while applying only the requested body and age modifications.';
  
  return prompt.trim();
}

export function validateEditParameters(params: EditParameters): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof params.bodyType !== 'number' || params.bodyType < -1 || params.bodyType > 1) {
    errors.push('Body type value must be a number between -1 and 1');
  }
  
  if (typeof params.ageChange !== 'number' || params.ageChange < -15 || params.ageChange > 20) {
    errors.push('Age change must be a number between -15 and +20 years');
  }
  
  if (typeof params.preserveClothing !== 'boolean') {
    errors.push('preserveClothing must be a boolean');
  }
  
  if (typeof params.isFullBody !== 'boolean') {
    errors.push('isFullBody must be a boolean');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getEditDescription(params: EditParameters): string {
  const { bodyType, ageChange, preserveClothing } = params;
  
  let description = 'Applied changes: ';
  
  // Body type description
  if (bodyType < -0.3) {
    description += 'Thinner body, ';
  } else if (bodyType > 0.3) {
    description += 'Heavier body, ';
  } else if (Math.abs(bodyType) > 0.1) {
    description += 'Athletic build, ';
  } else {
    description += 'No body changes, ';
  }
  
  // Age description
  if (ageChange === 0) {
    description += 'same age, ';
  } else if (ageChange > 0) {
    description += `aged +${Math.round(ageChange)} years, `;
  } else {
    description += `younger by ${Math.abs(Math.round(ageChange))} years, `;
  }
  
  // Clothing
  description += preserveClothing ? 'clothing preserved' : 'clothing not preserved';
  
  return description;
}