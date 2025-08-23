export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract parameters from the JSON body
    const { useCase, parameters } = req.body ?? {};
    let content;

    if (useCase === 'pullRequest') {
      content = `Generated pull request draft for title "${parameters?.title}" with description "${parameters?.description}".`;
    } else if (useCase === 'microcopy') {
      content = `Generated microcopy for heading "${parameters?.heading}" and description "${parameters?.description}".`;
    } else if (useCase === 'blogpost') {
      content = `Generated blog post draft for title "${parameters?.title}" with summary "${parameters?.summary}".`;
    } else {
      content = 'Unknown use case';
    }

    res.status(200).json({ status: 'success', content });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
}
