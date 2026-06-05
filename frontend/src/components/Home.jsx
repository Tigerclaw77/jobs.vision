import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import "../styles/Home.css";
import OptionsSection from "./OptionsSection";
import PricingTable from "./PricingTable";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";

const Home = () => {
  console.log("✅ Home.jsx is rendering");

  const reduxUser = useSelector((state) => state.auth.user);
  const { user: effectiveUser } = useEffectiveAuth();
  const user = effectiveUser ?? reduxUser;
  const role = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
  const isKnownSingleRole = role === "candidate" || role === "recruiter";

  // ✅ Mark roles that start a new wrapped line so they don’t show a dot
  useEffect(() => {
    const root = document.getElementById("roles-line");
    if (!root) return;

    const markLineStarts = () => {
      const items = Array.from(root.querySelectorAll("span"));
      items.forEach((s) => s.classList.remove("line-start"));

      if (!items.length) return;
      let lastTop = items[0].offsetTop;
      for (let i = 1; i < items.length; i++) {
        const t = items[i].offsetTop;
        if (t > lastTop) items[i].classList.add("line-start");
        lastTop = t;
      }
    };

    let rAF;
    const onResize = () => {
      cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(markLineStarts);
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(markLineStarts);
    } else {
      markLineStarts();
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="home">
      {/* 🔹 Semi-transparent veil over background image */}
      <div className="content-veil" />

      {/* 🔹 Banner Text */}
      <p className="banner-text-upper">
        Connecting Eyecare Professionals with New Opportunities
      </p>

      <p className="banner-text-lower roles" id="roles-line">
        <span>Doctors</span>
        <span>Opticians</span>
        <span>Techs</span>
        <span>Receptionists</span>
        <span>Office Managers</span>
        <span>Billers</span>
        <span>Support Staff</span>
      </p>

      {/* 🔹 Option Cards and Pricing */}
      <div className="component-wrapper">
        <OptionsSection user={user} />
        <PricingTable user={user} showAudienceToggle={!isKnownSingleRole} />
      </div>
    </div>
  );
};

export default Home;
