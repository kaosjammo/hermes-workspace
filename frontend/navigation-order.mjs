/** Capture navigation intent, then revalidate it inside the existing write queue.
 * Content saves may advance revision; a changed sibling set/order cancels intent.
 * The client owns profile/connection/epoch/scope and server revision fencing.
 */
export function navigationOrderPayload(state, request) {
  const siblings = state.items.filter(item => !item.deleted_at && item.kind !== 'record'
    && item.parent_id === request.parent);
  if (state.scope_id !== request.scope || siblings.length !== request.siblings.length
      || siblings.some((item, i) => item.id !== request.siblings[i])
      || !siblings.some(item => item.id === request.id)
      || !siblings.some(item => item.id === request.target_id))
    throw new Error('The folder order changed. Try reordering the current items again.');
  return { id: request.id, target_id: request.target_id, position: request.position };
}
