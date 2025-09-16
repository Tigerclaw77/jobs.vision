const tierRank = {
    guest: 0,
    free: 1,
    paid: 2,
    premium: 3
  };
  
  function requireTier(minTier) {
    return (req, res, next) => {
      const userTier = req.user?.tier || 'guest';
      if (tierRank[userTier] < tierRank[minTier]) {
        return res.status(403).json({ message: `Requires ${minTier} tier` });
      }
      next();
    };
  }
  
  module.exports = requireTier;
  