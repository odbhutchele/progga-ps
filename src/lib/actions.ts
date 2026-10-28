"use server";

import { revalidatePath } from "next/cache";
import {
  ClassSchema,
  ExamScheduleSchema,
  ExamSchema,
  LessonSchema,
  StudentSchema,
  SubjectSchema,
  TeacherSchema,
  SectionSchema,
  MergeClassSchema,
} from "./formValidationSchemas";
import { Day, Prisma } from "@prisma/client";
import prisma from "./prisma";
import { hashPassword } from "./password";
import { randomUUID } from "crypto";
import { authorizeRoles } from "./auth-server";
import { parseDateOnlyUtc } from "./schoolDate";

type CurrentState = { success: boolean; error: boolean; id?: string; message?: string };

const unauthorizedAction = () => ({
  success: false as const,
  error: true as const,
  message: "You are not authorized to perform this action.",
});

const requireAdmin = () => authorizeRoles(["admin"]);
const requireStaff = () => authorizeRoles(["admin", "teacher"]);

class StudentIdGenerationError extends Error {}

const nullableString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const nullableNumber = (value: number | string | null | undefined) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const subjectConnections = (subjectIds?: string[]) =>
  (subjectIds ?? [])
    .map((subjectId) => Number(subjectId))
    .filter((subjectId) => Number.isInteger(subjectId))
    .map((id) => ({ id }));

const getUniqueTarget = (err: unknown) => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return [];
  const target = err.meta?.target;
  return Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
};

const isPrismaCode = (err: unknown, code: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const isUniqueFieldError = (err: unknown, field: string) =>
  isPrismaCode(err, "P2002") && getUniqueTarget(err).includes(field);

const actionErrorMessage = (err: unknown) => {
  if (err instanceof StudentIdGenerationError) {
    return err.message;
  }

  if (isPrismaCode(err, "P2002")) {
    const target = getUniqueTarget(err);
    if (target.includes("email")) return "This email is already used.";
    if (target.includes("phone")) return "This phone number is already used.";
    if (target.includes("studentId")) return "A student ID conflict occurred. Please try again.";
    if (target.includes("teacherId")) return "A teacher ID conflict occurred. Please try again.";
    return "A record with the same unique information already exists.";
  }

  return "Something went wrong. Please check all fields and try again.";
};

export const createSubject = async (
  currentState: CurrentState,
  data: SubjectSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.subject.create({
      data: {
        name: data.name,
        classId: data.classId,
        teachers: {
          connect: data.teachers.map((teacherId) => ({ id: teacherId })),
        },
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const updateSubject = async (
  currentState: CurrentState,
  data: SubjectSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.subject.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        teachers: {
          set: data.teachers.map((teacherId) => ({ id: teacherId })),
        },
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const deleteSubject = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = data.get("id") as string;
  try {
    await prisma.subject.delete({
      where: {
        id: parseInt(id),
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const createClass = async (
  currentState: CurrentState,
  data: ClassSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.class.create({
      data: {
        ...data,
        supervisorId: data.supervisorId || null,
      },
    });

    // revalidatePath("/list/class");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const updateClass = async (
  currentState: CurrentState,
  data: ClassSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.class.update({
      where: {
        id: data.id,
      },
      data: {
        ...data,
        supervisorId: data.supervisorId || null,
      },
    });

    // revalidatePath("/list/class");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteClass = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = data.get("id") as string;
  try {
    await prisma.class.delete({
      where: {
        id: parseInt(id),
      },
    });

    // revalidatePath("/list/class");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createSection = async (
  currentState: CurrentState,
  data: SectionSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    const trimmedName = data.name.trim();
    const existing = await prisma.section.findUnique({
      where: {
        name_classId: {
          name: trimmedName,
          classId: data.classId,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: true,
        message: `Section "${trimmedName}" already exists in this class.`,
      };
    }

    const section = await prisma.section.create({
      data: {
        name: trimmedName,
        capacity: data.capacity ?? null,
        classId: data.classId,
        supervisorId: data.supervisorId || null,
      },
    });

    // Auto-link any existing students in this class whose string section matches this section name
    await prisma.student.updateMany({
      where: {
        classId: data.classId,
        section: { equals: trimmedName, mode: "insensitive" },
      },
      data: {
        sectionId: section.id,
        section: trimmedName,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const updateSection = async (
  currentState: CurrentState,
  data: SectionSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    if (!data.id) {
      return { success: false, error: true, message: "Section ID is missing" };
    }

    const current = await prisma.section.findUnique({
      where: { id: data.id },
    });

    if (!current) {
      return { success: false, error: true, message: "Section not found." };
    }

    const trimmedName = data.name.trim();

    await prisma.section.update({
      where: { id: data.id },
      data: {
        name: trimmedName,
        capacity: data.capacity ?? null,
        supervisorId: data.supervisorId || null,
      },
    });

    // If section name changed, keep student.section string in sync
    if (current.name !== trimmedName) {
      await prisma.student.updateMany({
        where: { sectionId: data.id },
        data: { section: trimmedName },
      });
    }

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const deleteSection = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = data.get("id") as string;
  try {
    const secId = parseInt(id);
    // Student sectionId becomes null via onDelete: SetNull
    await prisma.section.delete({
      where: { id: secId },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const mergeClassIntoSection = async (
  currentState: CurrentState,
  data: MergeClassSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const { sourceClassId, targetClassId, sectionName } = data;

  if (sourceClassId === targetClassId) {
    return {
      success: false,
      error: true,
      message: "Source class and target class cannot be the same.",
    };
  }

  try {
    const trimmedSectionName = sectionName.trim();

    await prisma.$transaction(async (tx) => {
      // 1. Verify source and target classes exist
      const sourceClass = await tx.class.findUnique({
        where: { id: sourceClassId },
        include: {
          students: true,
          subjects: true,
        },
      });

      const targetClass = await tx.class.findUnique({
        where: { id: targetClassId },
        include: {
          subjects: true,
        },
      });

      if (!sourceClass || !targetClass) {
        throw new Error("Source or target class was not found.");
      }

      // 2. Ensure or create target Section in target class
      let targetSection = await tx.section.findUnique({
        where: {
          name_classId: {
            name: trimmedSectionName,
            classId: targetClassId,
          },
        },
      });

      if (!targetSection) {
        targetSection = await tx.section.create({
          data: {
            name: trimmedSectionName,
            classId: targetClassId,
            capacity: sourceClass.capacity || null,
            supervisorId: sourceClass.supervisorId || null,
          },
        });
      }

      // 3. Move all students to target class and link to the section
      await tx.student.updateMany({
        where: { classId: sourceClassId },
        data: {
          classId: targetClassId,
          section: trimmedSectionName,
          sectionId: targetSection.id,
        },
      });

      // 4. Map subjects:
      // If target class already has subject with the same name, re-link foreign keys
      for (const srcSub of sourceClass.subjects) {
        const targetMatchingSub = targetClass.subjects.find(
          (ts) => ts.name.trim().toLowerCase() === srcSub.name.trim().toLowerCase()
        );

        if (targetMatchingSub) {
          await tx.lesson.updateMany({
            where: { subjectId: srcSub.id },
            data: { subjectId: targetMatchingSub.id, classId: targetClassId },
          });
          await tx.examSchedule.updateMany({
            where: { subjectId: srcSub.id },
            data: { subjectId: targetMatchingSub.id, classId: targetClassId },
          });
          await tx.result.updateMany({
            where: { subjectId: srcSub.id },
            data: { subjectId: targetMatchingSub.id },
          });
          await tx.subject.delete({
            where: { id: srcSub.id },
          });
        } else {
          await tx.subject.update({
            where: { id: srcSub.id },
            data: { classId: targetClassId },
          });
        }
      }

      // 5. Move remaining class-level records to targetClass
      await tx.lesson.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });
      await tx.attendance.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });
      await tx.event.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });
      await tx.announcement.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });
      await tx.notice.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });
      await tx.feePackage.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });
      await tx.examSchedule.updateMany({
        where: { classId: sourceClassId },
        data: { classId: targetClassId },
      });

      // 6. Delete empty source class
      await tx.class.delete({
        where: { id: sourceClassId },
      });
    });

    return {
      success: true,
      error: false,
      message: `Successfully merged class into Section "${trimmedSectionName}" with zero data loss!`,
    };
  } catch (err: any) {
    console.error("Merge class error:", err);
    return {
      success: false,
      error: true,
      message: err.message || "Failed to merge class.",
    };
  }
};

export const createTeacher = async (
  currentState: CurrentState,
  data: TeacherSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    const rawPassword = data.password || nullableString(data.phone) || "12345678";
    const hashedPassword = await hashPassword(rawPassword);
    const subjects = subjectConnections(data.subjects);

    await prisma.teacher.create({
      data: {
        id: randomUUID(),
        password: hashedPassword,
        name: data.name.trim(),
        surname: data.surname.trim(),
        email: nullableString(data.email),
        phone: nullableString(data.phone),
        address: data.address.trim(),
        img: nullableString(data.img),
        bloodType: data.bloodType.trim(),
        sex: data.sex,
        birthday: data.birthday,
        monthlySalary: nullableNumber(data.monthlySalary),
        ...(subjects.length > 0 ? { subjects: { connect: subjects } } : {}),
      },
    });

    // revalidatePath("/list/teachers");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const updateTeacher = async (
  currentState: CurrentState,
  data: TeacherSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  if (!data.id) {
    return { success: false, error: true };
  }
  try {
    const teacherPasswordUpdate =
      data.password && data.password !== ""
        ? { password: await hashPassword(data.password) }
        : {};
    const subjects = subjectConnections(data.subjects);

    await prisma.teacher.update({
      where: {
        id: data.id,
      },
      data: {
        ...teacherPasswordUpdate,
        name: data.name.trim(),
        surname: data.surname.trim(),
        email: nullableString(data.email),
        phone: nullableString(data.phone),
        address: data.address.trim(),
        img: nullableString(data.img),
        bloodType: data.bloodType.trim(),
        sex: data.sex,
        birthday: data.birthday,
        monthlySalary: nullableNumber(data.monthlySalary),
        subjects: {
          set: subjects,
        },
      },
    });
    // revalidatePath("/list/teachers");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true, message: actionErrorMessage(err) };
  }
};

export const deleteTeacher = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = data.get("id") as string;
  try {
    await prisma.teacher.delete({
      where: {
        id: id,
      },
    });

    // revalidatePath("/list/teachers");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

const generateStudentId = async (
  classId: number,
  client: typeof prisma | Prisma.TransactionClient = prisma
): Promise<number> => {
  const cls = await client.class.findUnique({ where: { id: classId } });
  if (!cls) throw new Error("Class not found");
  const classLevel = resolveStudentIdClassCode(cls);
  const year = new Date().getFullYear() % 100;
  const prefix = year * 100000 + classLevel * 1000;
  const last = await client.student.findFirst({
    where: { studentId: { gte: prefix, lt: prefix + 1000 } },
    orderBy: { studentId: "desc" },
  });
  const serial = last ? (last.studentId % 1000) + 1 : 1;
  if (serial > 999) throw new Error("Student ID limit reached for this class and year");
  return prefix + serial;
};

const PRE_PRIMARY_CLASS_CODES: { pattern: RegExp; code: number }[] = [
  { pattern: /\bplay\b/i, code: 91 },
  { pattern: /\bnursery\b/i, code: 92 },
  { pattern: /\bkindergarten\b|\bk\.?\s*g\b/i, code: 93 },
];

const resolveStudentIdClassCode = (cls: { id: number; name: string }) => {
  const numericPrefix = cls.name.trim().match(/^\d+/)?.[0];
  if (numericPrefix) {
    const code = Number(numericPrefix);
    if (code >= 0 && code <= 99) return code;
  }

  const matchedCode = PRE_PRIMARY_CLASS_CODES.find(({ pattern }) =>
    pattern.test(cls.name)
  )?.code;

  if (matchedCode) return matchedCode;

  const fallbackCode = cls.id + 50;
  if (fallbackCode >= 0 && fallbackCode <= 99) return fallbackCode;

  throw new StudentIdGenerationError(
    `Class "${cls.name}" needs a student ID code before admitting students.`
  );
};

const studentMutationData = (data: StudentSchema) => ({
  name: data.name.trim(),
  surname: data.surname.trim(),
  phone: nullableString(data.phone),
  address: data.address.trim(),
  img: nullableString(data.img),
  bloodType: data.bloodType.trim(),
  sex: data.sex,
  birthday: data.birthday,
  classId: data.classId,
  section: nullableString(data.section),
  fatherName: nullableString(data.fatherName),
  motherName: nullableString(data.motherName),
  rollNo: nullableNumber(data.rollNo),
  group: nullableString(data.group),
  shift: nullableString(data.shift),
  guardianName: nullableString(data.guardianName),
  guardianPhone: nullableString(data.guardianPhone),
  customTuitionFee: nullableNumber(data.customTuitionFee),
  admissionYear: nullableNumber(data.admissionYear),
  nameBn: nullableString(data.nameBn),
  birthRegNo: nullableString(data.birthRegNo),
  prevSchoolName: nullableString(data.prevSchoolName),
  prevSchoolClass: nullableString(data.prevSchoolClass),
  prevSchoolSection: nullableString(data.prevSchoolSection),
  prevSchoolRoll: nullableString(data.prevSchoolRoll),
  prevTutors: nullableString(data.prevTutors),
  fatherNameEn: nullableString(data.fatherNameEn),
  fatherPhone: nullableString(data.fatherPhone),
  fatherNid: nullableString(data.fatherNid),
  fatherAddress: nullableString(data.fatherAddress),
  fatherUpazila: nullableString(data.fatherUpazila),
  fatherWorkAddress: nullableString(data.fatherWorkAddress),
  motherNameEn: nullableString(data.motherNameEn),
  motherNid: nullableString(data.motherNid),
  religion: nullableString(data.religion),
  birthVillage: nullableString(data.birthVillage),
  birthDistrict: nullableString(data.birthDistrict),
  birthUpazila: nullableString(data.birthUpazila),
  birthThana: nullableString(data.birthThana),
  permVillage: nullableString(data.permVillage),
  permDistrict: nullableString(data.permDistrict),
  permUpazila: nullableString(data.permUpazila),
  permThana: nullableString(data.permThana),
  prevPassMarks: nullableNumber(data.prevPassMarks),
  prevSubjectCount: nullableNumber(data.prevSubjectCount),
  prevSession: nullableString(data.prevSession),
});

export const createStudent = async (
  currentState: CurrentState,
  data: StudentSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const admissionFeeAmount = nullableNumber(data.admissionFee) ?? 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const classItem = await tx.class.findUnique({
            where: { id: data.classId },
            include: { _count: { select: { students: true } } },
          });

          if (!classItem) {
            return {
              success: false as const,
              message: "Selected class was not found.",
            };
          }

          if (classItem.capacity <= classItem._count.students) {
            return {
              success: false as const,
              message: "Selected class is already full.",
            };
          }

          const studentId = await generateStudentId(data.classId, tx);
          const hashedPassword = await hashPassword(studentId.toString());
          const newId = randomUUID();

          await tx.student.create({
            data: {
              id: newId,
              studentId,
              password: hashedPassword,
              ...studentMutationData(data),
            },
          });

          if (admissionFeeAmount > 0) {
            const year = nullableNumber(data.admissionYear) ?? new Date().getFullYear();
            await tx.feeCollection.create({
              data: {
                studentId: newId,
                name: `Admission Fee ${year}`,
                amount: admissionFeeAmount,
                status: "UNPAID",
              },
            });
          }

          return { success: true as const, id: newId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (!result.success) {
        return { success: false, error: true, message: result.message };
      }

      revalidatePath("/list/students");
      return { success: true, error: false, id: result.id };
    } catch (err) {
      const shouldRetry =
        isUniqueFieldError(err, "studentId") || isPrismaCode(err, "P2034");

      if (shouldRetry && attempt < 3) continue;

      console.log(err);
      return { success: false, error: true, message: actionErrorMessage(err) };
    }
  }

  return {
    success: false,
    error: true,
    message: "Student admission could not be completed. Please try again.",
  };
};

export const updateStudent = async (
  currentState: CurrentState,
  data: StudentSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  if (!data.id) {
    return { success: false, error: true };
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const existingStudent = await tx.student.findUnique({
            where: { id: data.id },
            select: { classId: true },
          });

          if (!existingStudent) {
            return {
              success: false as const,
              message: "Student was not found.",
            };
          }

          if (existingStudent.classId !== data.classId) {
            const destinationClass = await tx.class.findUnique({
              where: { id: data.classId },
              include: { _count: { select: { students: true } } },
            });

            if (!destinationClass) {
              return {
                success: false as const,
                message: "Selected class was not found.",
              };
            }

            if (destinationClass.capacity <= destinationClass._count.students) {
              return {
                success: false as const,
                message: "Selected class is already full.",
              };
            }
          }

          await tx.student.update({
            where: { id: data.id },
            data: studentMutationData(data),
          });

          return { success: true as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (!result.success) {
        return { success: false, error: true, message: result.message };
      }

      revalidatePath("/list/students");
      revalidatePath(`/list/students/${data.id}`);
      return { success: true, error: false };
    } catch (err) {
      if (isPrismaCode(err, "P2034") && attempt < 3) continue;

      console.log(err);
      return { success: false, error: true, message: actionErrorMessage(err) };
    }
  }

  return {
    success: false,
    error: true,
    message: "Student update could not be completed. Please try again.",
  };
};

export const deleteStudent = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = data.get("id") as string;
  try {
    await prisma.student.delete({
      where: {
        id: id,
      },
    });

    revalidatePath("/list/students");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const createExam = async (
  currentState: CurrentState,
  data: ExamSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.exam.create({
      data: {
        title: data.title,
        semesterNumber: data.semesterNumber !== "" && data.semesterNumber != null ? Number(data.semesterNumber) : null,
        year: data.year !== "" && data.year != null ? Number(data.year) : null,
        semStartDate: data.semStartDate ? new Date(data.semStartDate) : null,
        semEndDate: data.semEndDate ? new Date(data.semEndDate) : null,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const updateExam = async (
  currentState: CurrentState,
  data: ExamSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.exam.update({
      where: { id: data.id },
      data: {
        title: data.title,
        semesterNumber: data.semesterNumber !== "" && data.semesterNumber != null ? Number(data.semesterNumber) : null,
        year: data.year !== "" && data.year != null ? Number(data.year) : null,
        semStartDate: data.semStartDate ? new Date(data.semStartDate) : null,
        semEndDate: data.semEndDate ? new Date(data.semEndDate) : null,
      },
    });

    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

export const deleteExam = async (
  currentState: CurrentState,
  data: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = data.get("id") as string;

  // const { userId, sessionClaims } = auth();
  // const role = (sessionClaims?.metadata as { role?: string })?.role;

  try {
    await prisma.exam.delete({
      where: {
        id: parseInt(id),
        // ...(role === "teacher" ? { lesson: { teacherId: userId! } } : {}),
      },
    });

    // revalidatePath("/list/subjects");
    return { success: true, error: false };
  } catch (err) {
    console.log(err);
    return { success: false, error: true };
  }
};

// Save bulk student marks for a given exam and subject
export const saveBulkResults = async (
  examId: number,
  subjectId: number,
  results: { studentId: string; score: number }[]
) => {
  const actor = await requireStaff();
  if (!actor) return { success: false, message: "You are not authorized to record marks." };

  const subject = await prisma.subject.findFirst({
    where: {
      id: subjectId,
      ...(actor.role === "teacher"
        ? { lessons: { some: { teacherId: actor.userId } } }
        : {}),
    },
    select: { classId: true },
  });
  if (!subject) {
    return {
      success: false,
      message:
        actor.role === "teacher"
          ? "You can only record marks for your assigned subjects."
          : "Subject not found.",
    };
  }

  const uniqueStudentIds = Array.from(new Set(results.map((result) => result.studentId)));
  if (uniqueStudentIds.length !== results.length) {
    return { success: false, message: "The marks submission contains duplicate students." };
  }
  const matchingStudents = await prisma.student.count({
    where: { id: { in: uniqueStudentIds }, classId: subject.classId },
  });
  if (matchingStudents !== uniqueStudentIds.length) {
    return { success: false, message: "One or more students do not belong to this subject's class." };
  }

  try {
    const calculateGradeAndGpa = (score: number) => {
      if (score >= 80) return { grade: "A+", gpa: 5.0 };
      if (score >= 70) return { grade: "A", gpa: 4.0 };
      if (score >= 60) return { grade: "A-", gpa: 3.5 };
      if (score >= 50) return { grade: "B", gpa: 3.0 };
      if (score >= 40) return { grade: "C", gpa: 2.0 };
      if (score >= 33) return { grade: "D", gpa: 1.0 };
      return { grade: "F", gpa: 0.0 };
    };

    // Find existing results for this exam+subject pair
    const existingResults = await prisma.result.findMany({
      where: { examId, subjectId },
    });

    const existingMap = new Map(existingResults.map((r) => [r.studentId, r.id]));

    await prisma.$transaction(
      results.map((r) => {
        const { grade, gpa } = calculateGradeAndGpa(r.score);
        const existingId = existingMap.get(r.studentId);

        if (existingId) {
          return prisma.result.update({
            where: { id: existingId },
            data: { score: r.score, grade, gpa },
          });
        } else {
          return prisma.result.create({
            data: {
              studentId: r.studentId,
              examId,
              subjectId,
              score: r.score,
              grade,
              gpa,
            },
          });
        }
      })
    );

    revalidatePath("/exams/marksheet");
    revalidatePath("/list/results");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to record marks." };
  }
};

export const saveBulkAttendance = async (
  classId: number,
  dateStr: string, // "YYYY-MM-DD"
  attendances: { studentId: string; present: boolean }[]
) => {
  const actor = await requireStaff();
  if (!actor) return { success: false, message: "You are not authorized to record attendance." };

  const attendanceDate = parseDateOnlyUtc(dateStr);
  if (!attendanceDate) {
    return { success: false, message: "Attendance date must be a valid YYYY-MM-DD date." };
  }

  if (actor.role === "teacher") {
    const assignedClass = await prisma.class.findFirst({
      where: { id: classId, lessons: { some: { teacherId: actor.userId } } },
      select: { id: true },
    });
    if (!assignedClass) {
      return { success: false, message: "You can only record attendance for your assigned classes." };
    }
  }

  const uniqueStudentIds = Array.from(new Set(attendances.map((attendance) => attendance.studentId)));
  if (uniqueStudentIds.length !== attendances.length) {
    return { success: false, message: "The attendance submission contains duplicate students." };
  }
  const matchingStudents = await prisma.student.count({
    where: { id: { in: uniqueStudentIds }, classId },
  });
  if (matchingStudents !== uniqueStudentIds.length) {
    return { success: false, message: "One or more students do not belong to this class." };
  }

  try {
    const existing = await prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: attendanceDate,
          lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    const existingMap = new Map(existing.map((a) => [a.studentId, a.id]));

    await prisma.$transaction(
      attendances.map((a) => {
        const existingId = existingMap.get(a.studentId);

        if (existingId) {
          return prisma.attendance.update({
            where: { id: existingId },
            data: { present: a.present },
          });
        } else {
          return prisma.attendance.create({
            data: {
              studentId: a.studentId,
              classId,
              date: attendanceDate,
              present: a.present,
            },
          });
        }
      })
    );

    revalidatePath("/list/attendance");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to record attendance." };
  }
};


// ── LESSON ACTIONS ────────────────────────────────────────────────────────────

const timeToDate = (timeStr: string): Date => {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(2025, 0, 1, h, m, 0);
};

export const createLesson = async (
  currentState: { success: boolean; error: boolean; message?: string },
  data: LessonSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: data.subjectId },
      select: { name: true },
    });
    await prisma.lesson.create({
      data: {
        name: subject?.name || "Lesson",
        day: data.day as Day,
        startTime: timeToDate(data.startTime),
        endTime: timeToDate(data.endTime),
        subjectId: data.subjectId,
        classId: data.classId,
        teacherId: data.teacherId,
      },
    });
    revalidatePath("/routine");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true, message: "Failed to create lesson." };
  }
};

export const updateLesson = async (
  currentState: { success: boolean; error: boolean; message?: string },
  data: LessonSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  if (!data.id) return { success: false, error: true };
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: data.subjectId },
      select: { name: true },
    });
    await prisma.lesson.update({
      where: { id: data.id },
      data: {
        name: subject?.name || "Lesson",
        day: data.day as Day,
        startTime: timeToDate(data.startTime),
        endTime: timeToDate(data.endTime),
        subjectId: data.subjectId,
        classId: data.classId,
        teacherId: data.teacherId,
      },
    });
    revalidatePath("/routine");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true, message: "Failed to update lesson." };
  }
};

export const deleteLesson = async (
  currentState: { success: boolean; error: boolean },
  formData: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = parseInt(formData.get("id") as string);
  try {
    await prisma.lesson.delete({ where: { id } });
    revalidatePath("/routine");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true };
  }
};

export const deleteEvent = async (
  currentState: { success: boolean; error: boolean; message?: string },
  formData: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { success: false, error: true, message: "Invalid event ID." };
  }

  try {
    await prisma.event.delete({ where: { id } });
    revalidatePath("/list/events");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true, message: "Failed to delete event." };
  }
};

export const deleteAnnouncement = async (
  currentState: { success: boolean; error: boolean; message?: string },
  formData: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { success: false, error: true, message: "Invalid announcement ID." };
  }

  try {
    await prisma.announcement.delete({ where: { id } });
    revalidatePath("/list/announcements");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true, message: "Failed to delete announcement." };
  }
};

// ── EXAM SCHEDULE ACTIONS ──────────────────────────────────────────────────────

const dateToDateTime = (dateStr: string): Date => new Date(dateStr + "T00:00:00");

export const createExamSchedule = async (
  currentState: { success: boolean; error: boolean; message?: string },
  data: ExamScheduleSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  try {
    await prisma.examSchedule.create({
      data: {
        examId: data.examId,
        classId: data.classId,
        subjectId: data.subjectId,
        date: dateToDateTime(data.date),
        startTime: timeToDate(data.startTime),
        endTime: timeToDate(data.endTime),
        room: data.room || null,
        totalMarks: data.totalMarks,
      },
    });
    revalidatePath("/exams/schedule");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true, message: "Failed to create schedule entry." };
  }
};

export const updateExamSchedule = async (
  currentState: { success: boolean; error: boolean; message?: string },
  data: ExamScheduleSchema
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  if (!data.id) return { success: false, error: true };
  try {
    await prisma.examSchedule.update({
      where: { id: data.id },
      data: {
        subjectId: data.subjectId,
        date: dateToDateTime(data.date),
        startTime: timeToDate(data.startTime),
        endTime: timeToDate(data.endTime),
        room: data.room || null,
        totalMarks: data.totalMarks,
      },
    });
    revalidatePath("/exams/schedule");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true, message: "Failed to update schedule entry." };
  }
};

export const deleteExamSchedule = async (
  currentState: { success: boolean; error: boolean },
  formData: FormData
) => {
  if (!(await requireAdmin())) return unauthorizedAction();
  const id = parseInt(formData.get("id") as string);
  try {
    await prisma.examSchedule.delete({ where: { id } });
    revalidatePath("/exams/schedule");
    return { success: true, error: false };
  } catch (err) {
    console.error(err);
    return { success: false, error: true };
  }
};

export const deleteScheduleEntry = async (id: number): Promise<{ success: boolean }> => {
  if (!(await requireAdmin())) return { success: false };
  try {
    await prisma.examSchedule.delete({ where: { id } });
    revalidatePath("/exams/schedule");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false };
  }
};

export const saveBulkSchedule = async (
  examId: number,
  classId: number,
  entries: {
    subjectId: number;
    entryId: number | null;
    date: string;
    startTime: string;
    endTime: string;
    room: string;
    totalMarks: number;
  }[]
): Promise<{ success: boolean }> => {
  if (!(await requireAdmin())) return { success: false };
  try {
    for (const entry of entries) {
      if (!entry.date) continue;

      const data = {
        date: dateToDateTime(entry.date),
        startTime: entry.startTime ? timeToDate(entry.startTime) : null,
        endTime: entry.endTime ? timeToDate(entry.endTime) : null,
        room: entry.room || null,
        totalMarks: entry.totalMarks,
      };

      if (entry.entryId) {
        await prisma.examSchedule.update({ where: { id: entry.entryId }, data });
      } else {
        await prisma.examSchedule.create({
          data: { examId, classId, subjectId: entry.subjectId, ...data },
        });
      }
    }
    revalidatePath("/exams/schedule");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false };
  }
};

export const resetPassword = async (
  role: "teacher" | "student" | "admin",
  id: string,
  newPassword: string
): Promise<{ success: boolean }> => {
  if (!(await requireAdmin())) return { success: false };
  try {
    const hashedPassword = await hashPassword(newPassword);

    if (role === "teacher") {
      await prisma.teacher.update({ where: { id }, data: { password: hashedPassword } });
    } else if (role === "student") {
      await prisma.student.update({ where: { id }, data: { password: hashedPassword } });
    } else {
      await prisma.admin.update({ where: { id }, data: { password: hashedPassword } });
    }

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false };
  }
};

export const upsertReportCard = async (
  studentId: string,
  academicYear: string,
  data: {
    comments?: string;
    moralBehavior?: string;
    sports?: boolean;
    culturalFunction?: boolean;
    scoutBnc?: boolean;
    mathOlympiad?: boolean;
  }
): Promise<{ success: boolean }> => {
  const actor = await requireStaff();
  if (!actor) return { success: false };

  if (actor.role === "teacher") {
    const assignedStudent = await prisma.student.findFirst({
      where: {
        id: studentId,
        class: { lessons: { some: { teacherId: actor.userId } } },
      },
      select: { id: true },
    });
    if (!assignedStudent) return { success: false };
  }

  try {
    await prisma.reportCard.upsert({
      where: { studentId_academicYear: { studentId, academicYear } },
      create: { studentId, academicYear, ...data },
      update: data,
    });
    revalidatePath("/report-cards");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false };
  }
};
