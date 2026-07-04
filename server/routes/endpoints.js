import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';

const router = Router();
const COL = 'api_endpoints';

// GET /api/endpoints — list all, newest first
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const docs = await db.collection(COL)
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    res.json(docs.map(toClient));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/endpoints — create
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const doc = {
      name: req.body.name,
      description: req.body.description || null,
      collection_name: req.body.collection_name || null,
      id_field: req.body.id_field || null,
      base_url: req.body.base_url,
      auth_type: req.body.auth_type || 'none',
      auth_config: req.body.auth_config || {},
      field_mappings: req.body.field_mappings || [],
      response_path: req.body.response_path || '',
      pagination_type: req.body.pagination_type || 'none',
      pagination_config: req.body.pagination_config || {},
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      last_fetched_at: null,
      last_error: null,
      created_at: now,
      updated_at: now,
    };
    const result = await db.collection(COL).insertOne(doc);
    res.status(201).json(toClient({ ...doc, _id: result.insertedId }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/endpoints/:id — update
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const _id = new ObjectId(req.params.id);
    const update = {
      $set: {
        name: req.body.name,
        description: req.body.description || null,
        collection_name: req.body.collection_name || null,
        id_field: req.body.id_field || null,
        base_url: req.body.base_url,
        auth_type: req.body.auth_type,
        auth_config: req.body.auth_config || {},
        field_mappings: req.body.field_mappings || [],
        response_path: req.body.response_path || '',
        pagination_type: req.body.pagination_type,
        pagination_config: req.body.pagination_config || {},
        is_active: req.body.is_active,
        updated_at: new Date(),
      },
    };
    const result = await db.collection(COL).findOneAndUpdate(
      { _id },
      update,
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(toClient(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/endpoints/:id/toggle — toggle is_active
router.patch('/:id/toggle', async (req, res) => {
  try {
    const db = getDb();
    const _id = new ObjectId(req.params.id);
    const doc = await db.collection(COL).findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const result = await db.collection(COL).findOneAndUpdate(
      { _id },
      { $set: { is_active: !doc.is_active, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    res.json(toClient(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/endpoints/:id/status — update last_fetched_at / last_error
router.patch('/:id/status', async (req, res) => {
  try {
    const db = getDb();
    const _id = new ObjectId(req.params.id);
    const $set = { updated_at: new Date() };
    if (req.body.last_fetched_at !== undefined) $set.last_fetched_at = req.body.last_fetched_at ? new Date(req.body.last_fetched_at) : null;
    if (req.body.last_error !== undefined) $set.last_error = req.body.last_error;

    const result = await db.collection(COL).findOneAndUpdate(
      { _id },
      { $set },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(toClient(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/endpoints/:id — delete endpoint + cascade records + logs
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const _id = new ObjectId(req.params.id);
    await db.collection(COL).deleteOne({ _id });
    await db.collection('data_records').deleteMany({ endpoint_id: _id });
    await db.collection('fetch_logs').deleteMany({ endpoint_id: _id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/endpoints/bulk-delete — delete multiple endpoints + cascade records + logs
router.post('/bulk-delete', async (req, res) => {
  try {
    const db = getDb();
    const ids = req.body.ids.map(id => new ObjectId(id));
    await db.collection(COL).deleteMany({ _id: { $in: ids } });
    await db.collection('data_records').deleteMany({ endpoint_id: { $in: ids } });
    await db.collection('fetch_logs').deleteMany({ endpoint_id: { $in: ids } });
    res.json({ success: true, deletedCount: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convert MongoDB doc to client shape (rename _id → id, format dates)
function toClient(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    id: _id.toString(),
    ...rest,
    last_fetched_at: rest.last_fetched_at ? rest.last_fetched_at.toISOString() : null,
    created_at: rest.created_at instanceof Date ? rest.created_at.toISOString() : rest.created_at,
    updated_at: rest.updated_at instanceof Date ? rest.updated_at.toISOString() : rest.updated_at,
  };
}

export default router;
