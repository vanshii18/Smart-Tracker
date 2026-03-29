const express = require('express');
const JobApplication = require('../models/JobApplication');

const router = express.Router();

/** YYYY-MM-DD strings compare correctly. Follow-up must be strictly after date applied. */
function followUpMustBeAfterApplied(dateApplied, followUpDate) {
  const a = dateApplied && String(dateApplied).trim();
  const f = followUpDate && String(followUpDate).trim();
  if (!a || !f) return null;
  if (f <= a) {
    return 'Follow-up date must be after the date applied.';
  }
  return null;
}

/** Log server-side issues and respond with 500 + a safe message */
function serverError(res, err, message) {
  console.error(err);
  res.status(500).json({ error: message });
}

// POST /api/applications — create a new application
router.post('/', async (req, res) => {
  try {
    const dateMsg = followUpMustBeAfterApplied(
      req.body.dateApplied,
      req.body.followUpDate
    );
    if (dateMsg) {
      return res.status(400).json({ error: dateMsg });
    }

    const application = await JobApplication.create(req.body);
    res.status(201).json(application);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Invalid data. Check required fields (e.g. company and role).',
        details: err.message,
      });
    }
    serverError(
      res,
      err,
      'Something went wrong while creating the application. Please try again.'
    );
  }
});

// GET /api/applications — list all applications
router.get('/', async (req, res) => {
  try {
    const applications = await JobApplication.find().sort({ _id: -1 });
    res.status(200).json(applications);
  } catch (err) {
    serverError(
      res,
      err,
      'Something went wrong while loading applications. Please try again.'
    );
  }
});

// PUT /api/applications/:id — update one application
router.put('/:id', async (req, res) => {
  try {
    const existing = await JobApplication.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        error:
          'No application found with that id. It may have been deleted already.',
      });
    }

    const merged = { ...existing.toObject(), ...req.body };
    const dateMsg = followUpMustBeAfterApplied(
      merged.dateApplied,
      merged.followUpDate
    );
    if (dateMsg) {
      return res.status(400).json({ error: dateMsg });
    }

    const application = await JobApplication.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!application) {
      return res.status(404).json({
        error:
          'No application found with that id. It may have been deleted already.',
      });
    }

    res.status(200).json(application);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Invalid data sent for update.',
        details: err.message,
      });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({
        error:
          'Invalid application id in the URL. Use a valid MongoDB id (24 hex characters).',
      });
    }
    serverError(
      res,
      err,
      'Something went wrong while updating the application. Please try again.'
    );
  }
});

// DELETE /api/applications/:id — remove one application
router.delete('/:id', async (req, res) => {
  try {
    const application = await JobApplication.findByIdAndDelete(req.params.id);

    if (!application) {
      return res.status(404).json({
        error:
          'No application found with that id. Nothing was deleted.',
      });
    }

    res.status(200).json({
      message: 'Application removed successfully.',
      id: application._id,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        error:
          'Invalid application id in the URL. Use a valid MongoDB id (24 hex characters).',
      });
    }
    serverError(
      res,
      err,
      'Something went wrong while deleting the application. Please try again.'
    );
  }
});

module.exports = router;
