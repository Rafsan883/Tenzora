export async function readEventStream(response, onEvent) {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'The assistant is unavailable. Please try again.');
  }
  if (!response.body) throw new Error('The assistant returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const consume = frame => {
    const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!payload) return;
    const event = JSON.parse(payload);
    if (event.status === 'error') throw new Error(event.message || 'The assistant could not respond.');
    if (event.status === 'done') {
      if (!event.success) throw new Error(event.message || 'The assistant could not respond.');
      completed = true;
    }
    onEvent(event);
  };
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replaceAll('\r\n', '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (completed) break;
      }
      if (done) {
        if (buffer.trim()) consume(buffer);
        if (!completed) throw new Error('The assistant connection ended before a response arrived.');
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
