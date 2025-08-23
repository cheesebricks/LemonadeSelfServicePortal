const useCases = {
  pr: [
    { name: 'title', label: 'Title' },
    { name: 'context', label: 'Context / Feature' }
  ],
  microcopy: [
    { name: 'tone', label: 'Tone (e.g., friendly, formal)' },
    { name: 'theme', label: 'Theme / Topic' }
  ],
  blogpost: [
    { name: 'headline', label: 'Headline' },
    { name: 'topic', label: 'Topic' },
    { name: 'length', label: 'Desired Length (words)' }
  ]
};

const useCaseSelect = document.getElementById('use-case');
const paramFieldsDiv = document.getElementById('param-fields');
const resultDiv = document.getElementById('result');
const submitBtn = document.getElementById('submit-btn');

function createInputField(field) {
  const wrapper = document.createElement('div');
  const label = document.createElement('label');
  label.textContent = field.label;
  label.htmlFor = field.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.id = field.name;
  input.name = field.name;
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

useCaseSelect.addEventListener('change', () => {
  paramFieldsDiv.innerHTML = '';
  const useCase = useCaseSelect.value;
  if (!useCase) return;
  useCases[useCase].forEach(field => {
    const inputField = createInputField(field);
    paramFieldsDiv.appendChild(inputField);
  });
});

submitBtn.addEventListener('click', async () => {
  const useCase = useCaseSelect.value;
  if (!useCase) {
    alert('Please select a use case.');
    return;
  }
  // Gather parameters
  const params = {};
  useCases[useCase].forEach(field => {
    const value = document.getElementById(field.name).value;
    params[field.name] = value;
  });
  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useCase, params })
    });
    const data = await response.json();
    if (data.status === 'success') {
      resultDiv.textContent = data.content || data.message;
      resultDiv.style.display = 'block';
    } else {
      resultDiv.textContent = 'Error: ' + data.message;
      resultDiv.style.display = 'block';
    }
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error;
    resultDiv.style.display = 'block';
  }
});
