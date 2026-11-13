const same = (a, b) => String(a) === String(b);

function statusChangeAllowed(app, actor, nextStatus) {
  const isOwner = same(actor, app.owner_id);
  const isApplicant = same(actor, app.applicant_id);
  if (!isOwner && !isApplicant) return false;
  if (app.status === 'pending') return isOwner && ['accepted', 'rejected'].includes(nextStatus);
  if (app.status === 'accepted') {
    return nextStatus === 'completion_requested' || (isOwner && nextStatus === 'cancellation_requested');
  }
  if (app.status === 'completion_requested') {
    return app.completion_requested_by && !same(actor, app.completion_requested_by) &&
      ['completed', 'accepted'].includes(nextStatus);
  }
  if (app.status === 'cancellation_requested') {
    return isApplicant && ['cancelled', 'accepted'].includes(nextStatus);
  }
  return false;
}

module.exports = { statusChangeAllowed };
