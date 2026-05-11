const express = require('express');
const router = express.Router();
const { generate, run, saveQuery, getHistory, updateQuery, deleteQuery } = require('../controllers/queryController');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/generate', generate);
router.post('/run', run);
router.post('/save', saveQuery);
router.get('/history', getHistory);
router.put('/history/:id', updateQuery);
router.delete('/history/:id', deleteQuery);

module.exports = router;
