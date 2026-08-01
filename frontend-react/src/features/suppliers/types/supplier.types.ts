// Matches backend-fastapi's SupplierBoardingSubmissionResponse (see
// models/supplier_boarding.py / api/routes/suppliers.py).
export interface SupplierUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export interface SupplierBoardingSubmission {
  id: number;
  supplier_name: string;
  notes: string | null;
  original_filename: string;
  content_type: string | null;
  size_bytes: number;
  uploaded_by: SupplierUser | null;
  created_at: string;
}
