import React, { useState, useContext, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeButton } from "@/components/hms/app-shell";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

const STUDENT_EMAIL_DOMAIN = "@ms.pict.edu";

export default function Login() {
  const { login, studentLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  const [role, setRole] = useState("student");
  const [step, setStep] = useState("identity"); // "identity" | "otp" | "register" | "password"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Student auth state
  const [studentToken, setStudentToken] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    prn: "",
    branch: "",
    joiningYear: "",
    rollNumber: "",
    classDiv: "",
    year: "FY",
    doorNumber: "",
  });

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendCountdown = (seconds = 60) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendTimer(seconds);
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  function switchRole(next) {
    setRole(next);
    setStep("identity");
    setError(null);
    setNotice(null);
    setOtp("");
    setPassword("");
  }

  // Handle identity submission (email)
  async function handleIdentity(e) {
    e.preventDefault();
    setError(null);

    if (role === "student") {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith(STUDENT_EMAIL_DOMAIN)) {
        setError(`Please use your college email ending in ${STUDENT_EMAIL_DOMAIN}`);
        return;
      }

      setBusy(true);
      try {
        const res = await api.post("/auth/student/send-otp", { email: cleanEmail });
        setNotice("A 6-digit verification code was sent to your college email.");
        setStep("otp");
        startResendCountdown(res.data?.resendAfter || 60);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to send OTP. Please try again.");
        if (err.response?.data?.resendAfter) {
          startResendCountdown(err.response.data.resendAfter);
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    // Staff or Warden goes to password step
    setStep("password");
  }

  // Handle student OTP verification
  async function handleOtp(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await api.post("/auth/student/verify-otp", {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });

      const { token, user: userData, prnInfo } = res.data;
      const isComplete = Boolean(userData?.profileComplete ?? res.data?.isProfileComplete);

      if (isComplete) {
        studentLogin(token, userData);
        navigate("/student-dashboard");
      } else {
        // Need profile completion
        setStudentToken(token);
        const autoPrn = prnInfo || {
          prn: userData?.prn || "",
          branch: userData?.branch || "",
          joiningYear: userData?.joiningYear ? String(userData.joiningYear) : "",
        };
        setForm((prev) => ({
          ...prev,
          prn: autoPrn.prn || prev.prn || "",
          branch: autoPrn.branch || prev.branch || "",
          joiningYear: autoPrn.joiningYear ? String(autoPrn.joiningYear) : prev.joiningYear,
        }));
        setNotice("First time here — please complete your hostel profile.");
        setStep("register");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect verification code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Handle resend OTP
  async function handleResendOtp() {
    if (resendTimer > 0) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.post("/auth/student/send-otp", {
        email: email.trim().toLowerCase(),
      });
      setNotice("A new 6-digit code has been sent.");
      startResendCountdown(res.data?.resendAfter || 60);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code.");
    } finally {
      setBusy(false);
    }
  }

  // Handle student profile completion
  async function handleRegister(e) {
    e.preventDefault();
    setError(null);

    const missing = ["fullName", "rollNumber", "doorNumber"].some(
      (k) => !form[k] || !String(form[k]).trim()
    );
    if (missing) {
      setError("Please fill in all required profile fields.");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post(
        "/auth/student/complete-profile",
        {
          token: studentToken,
          fullName: form.fullName.trim(),
          rollNumber: form.rollNumber.trim(),
          branch: form.branch || "CE",
          classDiv: form.classDiv || "1",
          year: form.year || "FY",
          doorNumber: form.doorNumber.trim(),
          acceptedTC: true,
        },
        {
          headers: {
            Authorization: `Bearer ${studentToken}`,
          },
        }
      );

      const { token, user: userData } = res.data;
      studentLogin(token || studentToken, userData);
      navigate("/student-dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to complete profile.");
    } finally {
      setBusy(false);
    }
  }

  // Handle staff / warden password sign in
  async function handlePassword(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await login(email.trim(), password);
      const loggedUser = res?.user || JSON.parse(sessionStorage.getItem("user"));

      if (loggedUser?.role === "WARDEN") {
        navigate("/admin-dashboard");
      } else if (loggedUser?.role === "STAFF") {
        navigate("/staff-dashboard");
      } else if (loggedUser?.role === "INCHARGE" || loggedUser?.role === "HEADWARDEN") {
        navigate("/incharge-dashboard");
      } else {
        navigate("/student-dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect email or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hms-root flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Hostel Management System</span>
        </div>
        <ThemeButton />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your role to access your hostel services.
          </p>

          <Tabs value={role} onValueChange={switchRole} className="mt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="warden">Warden</TabsTrigger>
              <TabsTrigger value="incharge">Incharge</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-5 rounded-xl border border-border bg-card p-5 shadow-xs">
            {step === "identity" ? (
              <form onSubmit={handleIdentity} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{role === "student" ? "College email" : "Work email"}</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    maxLength={120}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      role === "student"
                        ? `you${STUDENT_EMAIL_DOMAIN}`
                        : role === "incharge"
                        ? "incharge@pict.edu"
                        : role === "warden"
                        ? "warden@hostel.com"
                        : "staff@hostel.com"
                    }
                    className="h-11"
                  />
                  {role === "student" ? (
                    <p className="text-xs text-muted-foreground">
                      Only institutional {STUDENT_EMAIL_DOMAIN} addresses can log in.
                    </p>
                  ) : null}
                </div>

                {error ? <p className="text-sm text-[var(--hms-critical-foreground)]">{error}</p> : null}

                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {role === "student" ? "Send verification code" : "Continue"}
                </Button>
              </form>
            ) : null}

            {step === "otp" ? (
              <form onSubmit={handleOtp} className="space-y-4">
                <BackLink onClick={() => setStep("identity")} />
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter the 6-digit code</Label>
                  <InputOTP id="otp" maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-between">
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} className="size-11 rounded-md border" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
                </div>

                {error ? <p className="text-sm text-[var(--hms-critical-foreground)]">{error}</p> : null}

                <Button type="submit" className="h-11 w-full" disabled={busy || otp.length !== 6}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Verify & Sign in
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  disabled={busy || resendTimer > 0}
                  onClick={handleResendOtp}
                >
                  {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend code"}
                </Button>
              </form>
            ) : null}

            {step === "register" ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <BackLink onClick={() => setStep("otp")} />
                <p className="text-sm text-muted-foreground">{notice}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    value={form.fullName}
                    onChange={(v) => setForm({ ...form, fullName: v })}
                    className="sm:col-span-2"
                  />
                  <Field
                    label="PRN"
                    value={form.prn}
                    onChange={(v) => setForm({ ...form, prn: v })}
                  />
                  <Field
                    label="Branch"
                    value={form.branch}
                    onChange={(v) => setForm({ ...form, branch: v })}
                  />
                  <Field
                    label="Roll number"
                    value={form.rollNumber}
                    onChange={(v) => setForm({ ...form, rollNumber: v })}
                  />
                  <Field
                    label="Class & Division"
                    value={form.classDiv}
                    onChange={(v) => setForm({ ...form, classDiv: v })}
                    placeholder="e.g. SE-1"
                  />
                  <Field
                    label="Year"
                    value={form.year}
                    onChange={(v) => setForm({ ...form, year: v })}
                    placeholder="FY / SY / TY"
                  />
                  <Field
                    label="Room number"
                    value={form.doorNumber}
                    onChange={(v) => setForm({ ...form, doorNumber: v })}
                    className="sm:col-span-2"
                    placeholder="e.g. 101"
                  />
                </div>

                {error ? <p className="text-sm text-[var(--hms-critical-foreground)]">{error}</p> : null}

                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Complete Profile & Enter
                </Button>
              </form>
            ) : null}

            {step === "password" ? (
              <form onSubmit={handlePassword} className="space-y-4">
                <BackLink onClick={() => setStep("identity")} />
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                  />
                </div>

                {error ? <p className="text-sm text-[var(--hms-critical-foreground)]">{error}</p> : null}

                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Sign in
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </button>
  );
}

function Field({ label, value, onChange, placeholder, className }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        maxLength={60}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
      />
    </div>
  );
}