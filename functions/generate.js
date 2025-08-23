export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', message: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  const { useCase, params } = body;
  let content = '';
  if (useCase === 'pr') {
    content = `Pull Request: ${params.title}\n\nContext: ${params.context}\n\nThis PR introduces changes to ${params.context}. Please review the implementation and provide feedback.`;
  } else if (useCase === 'microcopy') {
    content = `Microcopy with tone ${params.tone} about ${params.theme}.\n\nExample: This is a ${params.tone} microcopy for ${params.theme}.`;
  } else if (useCase === 'blogpost') {
    content = `Blog Post: ${params.headline}\nTopic: ${params.topic}\nDesired length: ${params.length} words.\n\nIntro paragraph ... (generated content would go here).`;
  } else {
    content = 'Unknown use case.';
  }
  return new Response(JSON.stringify({ status: 'success', content }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
