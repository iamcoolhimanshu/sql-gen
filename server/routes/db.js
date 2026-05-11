const express = require('express');
const router = express.Router();
const { getConnections, addConnection, testConnection, deleteConnection, getSchema } = require('../controllers/dbController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/connections', getConnections);
router.post('/connect', addConnection);
router.post('/test', testConnection);
router.delete('/connections/:id', deleteConnection);
router.get('/schema/:connectionId', getSchema);

module.exports = router;
