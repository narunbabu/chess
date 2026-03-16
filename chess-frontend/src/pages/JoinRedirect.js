import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../config';

/**
 * /join/:code — Stores referral code, checks for org association, and redirects to registration.
 * Short URL for sharing: chess99.com/join/ABC12345
 *
 * If the referral code belongs to an institute admin, the org info is stored
 * so registration can auto-select the institute.
 */
const JoinRedirect = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    localStorage.setItem('chess99_referral_code', code);

    // Validate the code to check if it's from an org admin
    fetch(`${BACKEND_URL}/referrals/validate/${code}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.organization) {
          localStorage.setItem('chess99_referral_org', JSON.stringify(data.organization));
        } else {
          localStorage.removeItem('chess99_referral_org');
        }
      })
      .catch(() => {
        // Non-critical — proceed even if validation fails
      })
      .finally(() => {
        navigate(`/login?ref=${code}`, { replace: true });
      });
  }, [code, navigate]);

  return null;
};

export default JoinRedirect;
