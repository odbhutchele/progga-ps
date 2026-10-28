import { z } from "zod";

export const subjectSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Subject name is required!" }),
  classId: z.coerce.number({ required_error: "Class is required!" }),
  teachers: z.array(z.string()), //teacher ids
});

export type SubjectSchema = z.infer<typeof subjectSchema>;

export const classSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Class name is required!" }),
  capacity: z.coerce.number().min(1, { message: "Capacity is required!" }),
  supervisorId: z.string().optional().transform(v => v === "" ? undefined : v),
});

export type ClassSchema = z.infer<typeof classSchema>;

export const sectionSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, { message: "Section name is required (e.g. A, B, Padma)" }),
  capacity: z
    .union([z.coerce.number().min(1), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v))),
  classId: z.coerce.number({ required_error: "Class is required!" }),
  supervisorId: z
    .string()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});

export type SectionSchema = z.infer<typeof sectionSchema>;

export const mergeClassSchema = z.object({
  sourceClassId: z.coerce.number({ required_error: "Source class is required!" }),
  targetClassId: z.coerce.number({ required_error: "Target class is required!" }),
  sectionName: z.string().min(1, { message: "Section name is required (e.g. A, B)" }),
});

export type MergeClassSchema = z.infer<typeof mergeClassSchema>;

export const teacherSchema = z.object({
  id: z.string().optional(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long!" })
    .optional()
    .or(z.literal("")),
  name: z.string().min(1, { message: "First name is required!" }),
  surname: z.string().min(1, { message: "Last name is required!" }),
  email: z
    .string()
    .email({ message: "Invalid email address!" })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
  address: z.string(),
  img: z.string().optional(),
  bloodType: z.string().min(1, { message: "Blood Type is required!" }),
  birthday: z.coerce.date({ message: "Birthday is required!" }),
  sex: z.enum(["MALE", "FEMALE"], { message: "Sex is required!" }),
  subjects: z.array(z.string()).optional(), // subject ids
  monthlySalary: z.coerce.number().min(0).optional().or(z.literal("")),
});

export type TeacherSchema = z.infer<typeof teacherSchema>;

export const studentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: "First name is required!" }),
  surname: z.string().min(1, { message: "Last name is required!" }),
  phone: z.string().optional(),
  address: z.string().min(1, { message: "Address is required!" }),
  img: z.string().optional(),
  bloodType: z.string().min(1, { message: "Blood Type is required!" }),
  birthday: z.coerce.date({ message: "Birthday is required!" }),
  sex: z.enum(["MALE", "FEMALE"], { message: "Sex is required!" }),
  classId: z.coerce.number().min(1, { message: "Class is required!" }),
  section: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  rollNo: z.coerce.number().int().min(1).optional().or(z.literal("")),
  group: z.string().optional(),
  shift: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  customTuitionFee: z.coerce.number().min(0).optional().or(z.literal("")),
  admissionFee: z.coerce.number().min(0, { message: "Admission fee is required!" }),
  // Admission form fields
  admissionYear: z.coerce.number().int().optional().or(z.literal("")),
  nameBn: z.string().optional(),
  birthRegNo: z.string().optional(),
  prevSchoolName: z.string().optional(),
  prevSchoolClass: z.string().optional(),
  prevSchoolSection: z.string().optional(),
  prevSchoolRoll: z.string().optional(),
  prevTutors: z.string().optional(),
  fatherNameEn: z.string().optional(),
  fatherPhone: z.string().optional(),
  fatherNid: z.string().optional(),
  fatherAddress: z.string().optional(),
  fatherUpazila: z.string().optional(),
  fatherWorkAddress: z.string().optional(),
  motherNameEn: z.string().optional(),
  motherNid: z.string().optional(),
  religion: z.string().optional(),
  birthVillage: z.string().optional(),
  birthDistrict: z.string().optional(),
  birthUpazila: z.string().optional(),
  birthThana: z.string().optional(),
  permVillage: z.string().optional(),
  permDistrict: z.string().optional(),
  permUpazila: z.string().optional(),
  permThana: z.string().optional(),
  prevPassMarks: z.coerce.number().int().optional().or(z.literal("")),
  prevSubjectCount: z.coerce.number().int().optional().or(z.literal("")),
  prevSession: z.string().optional(),
});

export type StudentSchema = z.infer<typeof studentSchema>;

export const examSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1, { message: "Title is required!" }),
  semesterNumber: z.coerce.number().int().min(1).max(4).optional().or(z.literal("")),
  year: z.coerce.number().int().min(2020).optional().or(z.literal("")),
  semStartDate: z.string().optional().or(z.literal("")),
  semEndDate: z.string().optional().or(z.literal("")),
});

export type ExamSchema = z.infer<typeof examSchema>;

export const examScheduleSchema = z.object({
  id: z.coerce.number().optional(),
  examId: z.coerce.number({ required_error: "Exam is required!" }),
  classId: z.coerce.number({ required_error: "Class is required!" }),
  subjectId: z.coerce.number({ required_error: "Subject is required!" }).min(1, "Subject is required!"),
  date: z.string().min(1, { message: "Date is required!" }),
  startTime: z.string().min(1, { message: "Start time is required!" }),
  endTime: z.string().min(1, { message: "End time is required!" }),
  room: z.string().optional(),
  totalMarks: z.coerce.number().int().min(1, "Must be at least 1").default(100),
});

export type ExamScheduleSchema = z.infer<typeof examScheduleSchema>;

export const lessonSchema = z.object({
  id: z.coerce.number().optional(),
  day: z.enum(["SAT", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"], {
    required_error: "Day is required!",
  }),
  subjectId: z.coerce.number({ required_error: "Subject is required!" }).min(1, "Subject is required!"),
  teacherId: z.string().min(1, { message: "Teacher is required!" }),
  classId: z.coerce.number(),
  startTime: z.string().min(1, { message: "Start time is required!" }),
  endTime: z.string().min(1, { message: "End time is required!" }),
});

export type LessonSchema = z.infer<typeof lessonSchema>;
