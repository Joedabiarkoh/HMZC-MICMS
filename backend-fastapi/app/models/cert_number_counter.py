from sqlalchemy import Column, Integer, String, UniqueConstraint

from app.models.base import BaseModel

# Requested directly: "the loose gear seems to use only job number,
# the two section, make one certificate number which keep count for
# the certificate of loose gear created under that job number while
# the job number stays same for all those certificate." Before this,
# a Loose Gear certificate's own cert_no WAS its Job's job_no with a
# suffix appended (e.g. "JOB-MVTEST-20260809-001") — functional, but
# reads as two identifiers glued together rather than one clean
# certificate number the way every other equipment type's does (see
# generateCertNo, inspectionHelpers.ts, for that shared
# "CERT/HMZC/{TAG}/{date}-{seq}" convention).
#
# This is what makes that possible without a collision: cert_no's own
# sequence is scoped by (tag, date) — the SAME shape every other
# equipment type's client-side generateCertNo already uses, just
# assigned atomically here instead, since Loose Gear specifically can
# have many technicians reserving numbers for the same job at once
# (see the "300 items" reasoning in models/job.py). Deliberately NOT
# scoped by job — two different jobs opened on the same calendar day
# draw from the same counter and get interleaved (but still globally
# unique, still stable) numbers; the Job itself (a separate field,
# unaffected by any of this) is what still ties a job's certificates
# together for tracking, not adjacency in the certificate number.
#
# date_key is the JOB's own creation date, not "today" — a job that
# runs for a week keeps drawing from the SAME day's counter throughout
# (see api/routes/jobs.py's reserve_cert_no), for the same reason the
# Job's own number doesn't change day to day: "issuing certificate can
# take days... if you change the certificate number... because it was
# issued on different items, it will be confusing."
class CertNumberCounter(BaseModel):
    __tablename__ = "cert_number_counters"

    id = Column(Integer, primary_key=True, index=True)
    tag = Column(String, nullable=False)
    date_key = Column(String, nullable=False)  # YYYYMMDD
    next_seq = Column(Integer, nullable=False, default=1)

    __table_args__ = (UniqueConstraint("tag", "date_key", name="uq_cert_number_counters_tag_date"),)
