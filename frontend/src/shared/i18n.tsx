import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'bn';

export const LANG_STORAGE_KEY = 'school_admission_lang';

export const TRANSLATIONS = {
  en: {
    // Top bar & Brand
    brand_name: 'School Admission',
    brand_session: 'Session 2026-2027',
    nav_student: 'Student',
    nav_admin: 'Admin',
    nav_gallery: 'Gallery',

    // Student Sub-Nav
    nav_classes: 'Classes',
    nav_my_applications: 'My applications',
    student_id_prefix: 'Student ID:',
    btn_change: 'Change',
    btn_enter_student_id: 'Enter Student ID',

    // Admin Sidebar
    admin_portal: 'Admin Portal',
    admin_management: 'Management',
    nav_admin_dashboard: 'Dashboard',
    nav_admin_manage_classes: 'Manage classes',
    nav_admin_create_class: 'Create class',

    // Page 1: Student Identity
    identity_title: 'Student Identity',
    identity_desc:
      "Enter the student's 17-digit birth registration number. This number is used to hold seats and verify your admission.",
    identity_label: 'Birth Registration Number',
    identity_digits_counter: '{count} / 17 digits',
    identity_digits_complete: '{count} / 17 digits ✓',
    identity_info_title: 'No login required',
    identity_info_msg:
      'Your birth registration number uniquely identifies your admission applications. It is saved in your browser so your active holds remain accessible after page refresh.',
    identity_submit: 'Continue to Classes',
    err_digits_only: 'Only numeric digits (0-9) are allowed in birth registration numbers.',
    err_enter_id: 'Please enter your 17-digit birth registration number.',
    err_exact_17_digits: 'Birth registration number must be exactly 17 digits (currently {count} digits).',
    err_17_numeric_digits: 'Birth registration number must contain exactly 17 numeric digits.',

    // Page 2: Student Dashboard
    dashboard_title: 'Admission Overview',
    dashboard_subtitle: 'Live seat availability for Session 2026-2027',
    tile_shifts: 'Available Shifts',
    tile_available_seats: 'Available Seats',
    tile_total_capacity: 'Total Capacity',
    tile_active_hold: 'Active Application',
    active_hold_title: 'Your Active Seat Hold',
    active_hold_subtitle: 'Time remaining to complete payment',
    active_hold_view_pay: 'View & Pay Now',
    active_hold_more: '+{count} more active application',
    active_hold_more_plural: '+{count} more active applications',
    no_active_hold_title: 'No Active Hold',
    no_active_hold_desc: 'Apply for an open class below to reserve a seat.',
    section_classes_title: 'Available Classes & Shifts',
    section_classes_desc: 'Apply for your preferred class shift. First come, first served.',
    no_classes_found: 'No classes available right now. Please check back soon.',
    seats_left: '{count} left',
    seats_held_stat: '{count} held',
    seats_confirmed_stat: '{count} confirmed',
    label_available: 'Available',
    label_held: 'Held',
    label_confirmed: 'Confirmed',
    label_total: 'Total',
    btn_apply_seat: 'Apply for Seat',
    btn_applying: 'Applying...',
    btn_class_full: 'Class Full',
    btn_already_applied: 'Already Applied',
    btn_view_details: 'View Details',

    // Page 3: Class Details
    details_back: 'Back to classes',
    details_fcfs_notice: 'First come, first served. Seats are held for {min} minutes once applied.',
    details_breakdown_title: 'Class Capacity Breakdown',
    details_tile_total: 'Total Seats',
    details_tile_available: 'Available',
    details_tile_held: 'Currently Held',
    details_tile_confirmed: 'Confirmed Admissions',
    details_big_available: 'Seats Available',
    details_big_available_sub: 'Seats remaining for immediate reservation',
    details_one_seat_note: 'Notice: You can hold one seat per class at a time.',
    details_apply_btn: 'Apply for this Seat',
    details_class_full: 'This class has no seats available at the moment.',
    details_not_found_title: 'Class Not Found',
    details_not_found_desc: 'The requested class could not be found or has been removed.',

    // Page 4: Hold Application
    hold_title: 'Seat Reservation',
    hold_subtitle: 'Application status: {status}',
    status_held: 'HELD',
    status_confirmed: 'CONFIRMED',
    status_expired: 'EXPIRED',
    status_cancelled: 'CANCELLED',
    hold_time_left: 'Time Left',
    hold_time_expired: 'Expired',
    hold_summary_title: 'Reservation Summary',
    hold_class_name: 'Class Shift',
    hold_student_id: 'Student ID',
    hold_started_at: 'Hold Started',
    hold_expires_at: 'Expires At',
    hold_confirmed_at: 'Confirmed At',
    hold_btn_pay: 'Pay admission fee',
    hold_btn_paying: 'Processing Payment...',
    hold_btn_pay_disabled_expired: 'Pay admission fee (Disabled — Hold Expired)',
    hold_btn_cancel: 'Cancel Reservation',
    hold_btn_cancelling: 'Cancelling...',
    hold_simulated_notice_title: 'Simulated Payment',
    hold_simulated_notice_desc:
      'This is a simulated payment. Pressing "Pay admission fee" immediately confirms admission without an external payment gateway.',
    hold_confirmed_banner_title: 'Admission Confirmed!',
    hold_confirmed_banner_desc:
      'Your admission for {name} has been successfully confirmed. Please save your Student ID for records.',
    hold_expired_banner_title: 'Hold Expired',
    hold_expired_banner_desc:
      'The time limit to confirm this seat has elapsed. The seat has been automatically returned to the available pool.',
    hold_cancelled_banner_title: 'Hold Cancelled',
    hold_cancelled_banner_desc:
      'You have cancelled this seat hold. The seat has been returned to the available pool.',
    hold_apply_again: 'Apply for Another Seat',
    hold_not_found_title: 'Application Not Found',
    hold_not_found_desc: 'The requested seat hold does not exist or may have expired.',

    // Page 5: My Applications
    my_apps_title: 'My Applications',
    my_apps_subtitle: 'Track all your admission seat holds and confirmations',
    my_apps_empty_title: 'No applications found',
    my_apps_empty_desc: 'You have not applied for any class shifts yet. Choose an open class to get started.',
    my_apps_btn_apply_now: 'Browse Classes',
    my_apps_th_class: 'Class Shift',
    my_apps_th_status: 'Status',
    my_apps_th_timeline: 'Timeline',
    my_apps_th_action: 'Action',
    my_apps_held_time_left: '{time} left',
    my_apps_paid_on: 'Paid on {time}',
    my_apps_expired_desc: 'Seat returned to pool',
    my_apps_cancelled_desc: 'Cancelled by applicant',
    my_apps_btn_view: 'Details',
    my_apps_btn_pay: 'Pay Now',
    my_apps_btn_cancel: 'Cancel',

    // Page 6: Admin Dashboard
    admin_dashboard_title: 'Admin Dashboard',
    admin_dashboard_subtitle: 'Real-time class admission metrics and seat occupancy',
    admin_tile_total_classes: 'Total Class Shifts',
    admin_tile_total_seats: 'Total Seats',
    admin_tile_held_seats: 'Held Seats',
    admin_tile_confirmed_seats: 'Confirmed Seats',
    admin_seats_by_class: 'Seats by Class Shift',
    admin_seats_by_class_desc: 'Breakdown of seat occupancy across all shifts',
    admin_no_classes_yet: 'No classes have been created yet.',
    admin_btn_create_first: 'Create your first class',

    // Page 7: Manage Classes
    manage_classes_title: 'Manage Classes',
    manage_classes_subtitle: 'Monitor seat allocations, search classes, and adjust capacity',
    manage_search_placeholder: 'Search classes by name or shift...',
    manage_btn_new_class: 'Create New Class',
    manage_th_class_name: 'Class Shift',
    manage_th_total: 'Total',
    manage_th_held: 'Held',
    manage_th_confirmed: 'Confirmed',
    manage_th_available: 'Available',
    manage_th_occupancy: 'Occupancy',
    manage_th_actions: 'Actions',
    manage_btn_edit: 'Edit',
    manage_no_search_results: 'No classes match your search query.',

    // Page 8: Create / Edit Class
    form_create_title: 'Create Class',
    form_edit_title: 'Edit Class',
    form_create_subtitle: 'Define a new class shift and seat allocation',
    form_edit_subtitle: 'Update class name and adjust total capacity',
    form_label_class: 'Class Name',
    form_placeholder_class: 'e.g. Class 6',
    form_label_shift: 'Shift',
    shift_morning: 'Morning Shift',
    shift_day: 'Day Shift',
    shift_evening: 'Evening Shift',
    shift_none: 'No Shift',
    form_label_total_seats: 'Total Seats',
    form_seats_help: 'Must be between 1 and 10,000.',
    form_preview_title: 'Class Preview',
    form_preview_subtitle: 'How it will appear to parents and students',
    form_btn_create: 'Create Class',
    form_btn_update: 'Save Changes',
    form_btn_submitting: 'Saving...',
    form_btn_cancel: 'Cancel',
    form_err_name_req: 'Class name is required.',
    form_err_seats_req: 'Total seats must be a valid number between 1 and 10,000.',
    form_err_seats_below_occupied:
      'Total seats cannot be reduced below {count} (currently {held} held + {confirmed} confirmed).',
    form_success_created: 'Class "{name}" created successfully.',
    form_success_updated: 'Class "{name}" updated successfully.',

    // Common / Global
    loading: 'Loading...',
    server_issue_title: 'Server connection issue',
    server_issue_msg: 'Server is currently unreachable. Retrying automatically...',
  },
  bn: {
    // Top bar & Brand
    brand_name: 'স্কুল ভর্তি',
    brand_session: 'শিক্ষাবর্ষ ২০২৬-২০২৭',
    nav_student: 'শিক্ষার্থী',
    nav_admin: 'এডমিন',
    nav_gallery: 'গ্যালারি',

    // Student Sub-Nav
    nav_classes: 'ক্লাসসমূহ',
    nav_my_applications: 'আমার আবেদনসমূহ',
    student_id_prefix: 'শিক্ষার্থী আইডি:',
    btn_change: 'পরিবর্তন',
    btn_enter_student_id: 'আইডি লিখুন',

    // Admin Sidebar
    admin_portal: 'এডমিন পোর্টাল',
    admin_management: 'ব্যবস্থাপনা',
    nav_admin_dashboard: 'ড্যাশবোর্ড',
    nav_admin_manage_classes: 'ক্লাস পরিচালনা',
    nav_admin_create_class: 'নতুন ক্লাস',

    // Page 1: Student Identity
    identity_title: 'শিক্ষার্থীর পরিচয়',
    identity_desc:
      'শিক্ষার্থীর ১৭-সংখ্যার জন্ম নিবন্ধন নম্বর প্রবেশ করান। আসন সংরক্ষণ ও ভর্তি যাচাইয়ে এটি ব্যবহৃত হয়।',
    identity_label: 'জন্ম নিবন্ধন নম্বর',
    identity_digits_counter: '{count} / ১৭ সংখ্যা',
    identity_digits_complete: '{count} / ১৭ সংখ্যা ✓',
    identity_info_title: 'কোনো লগইন প্রয়োজন নেই',
    identity_info_msg:
      'আপনার জন্ম নিবন্ধন নম্বরটি আপনার ভর্তি আবেদন চিহ্নিত করে। এটি আপনার ব্রাউজারে সংরক্ষিত থাকবে যাতে পেজ রিফ্রেশ করলেও আবেদনটি পাওয়া যায়।',
    identity_submit: 'ক্লাস তালিকায় এগিয়ে যান',
    err_digits_only: 'জন্ম নিবন্ধন নম্বরে শুধুমাত্র সংখ্যা (০-৯) গ্রহণযোগ্য।',
    err_enter_id: 'অনুগ্রহ করে আপনার ১৭-সংখ্যার জন্ম নিবন্ধন নম্বর লিখুন।',
    err_exact_17_digits: 'জন্ম নিবন্ধন নম্বর অবশ্যই ১৭ সংখ্যার হতে হবে (বর্তমানে {count} সংখ্যা)।',
    err_17_numeric_digits: 'জন্ম নিবন্ধন নম্বর অবশ্যই ১৭টি সংখ্যার হতে হবে।',

    // Page 2: Student Dashboard
    dashboard_title: 'ভর্তি সংক্রান্ত তথ্য',
    dashboard_subtitle: '২০২৬-২০২৭ শিক্ষাবর্ষের আসন সংক্রান্ত লাইভ তথ্য',
    tile_shifts: 'উন্মুক্ত শিফট',
    tile_available_seats: 'ফাঁকা আসন',
    tile_total_capacity: 'মোট আসন ক্ষমতা',
    tile_active_hold: 'সক্রিয় আবেদন',
    active_hold_title: 'আপনার সংরক্ষিত আসন',
    active_hold_subtitle: 'ফি জমা দেওয়ার বাকি সময়',
    active_hold_view_pay: 'দেখুন ও ফি দিন',
    active_hold_more: '+{count}টি আরও সক্রিয় আবেদন',
    active_hold_more_plural: '+{count}টি আরও সক্রিয় আবেদন',
    no_active_hold_title: 'কোনো সক্রিয় আসন নেই',
    no_active_hold_desc: 'আসন সংরক্ষণের জন্য নিচের উন্মুক্ত ক্লাসে আবেদন করুন।',
    section_classes_title: 'উপলব্ধ ক্লাস ও শিফটসমূহ',
    section_classes_desc: 'আপনার পছন্দের ক্লাসের শিফটে আবেদন করুন। আগে আসলে আগে পাবেন।',
    no_classes_found: 'বর্তমানে কোনো ক্লাস উপলব্ধ নেই। অনুগ্রহ করে কিছুক্ষণ পর আবার দেখুন।',
    seats_left: '{count}টি বাকি',
    seats_held_stat: '{count} সংরক্ষিত',
    seats_confirmed_stat: '{count} নিশ্চিত',
    label_available: 'ফাঁকা',
    label_held: 'সংরক্ষিত',
    label_confirmed: 'নিশ্চিত',
    label_total: 'মোট',
    btn_apply_seat: 'আসন আবেদন করুন',
    btn_applying: 'আবেদন হচ্ছে...',
    btn_class_full: 'আসন পূর্ণ',
    btn_already_applied: 'ইতিমধ্যে আবেদন করেছেন',
    btn_view_details: 'বিস্তারিত দেখুন',

    // Page 3: Class Details
    details_back: 'ক্লাস তালিকায় ফিরুন',
    details_fcfs_notice: 'আগে আসলে আগে পাবেন ভিত্তিতে আবেদনকৃত আসন {min} মিনিটের জন্য সংরক্ষিত থাকবে।',
    details_breakdown_title: 'ক্লাসের আসন বিন্যাস',
    details_tile_total: 'মোট আসন',
    details_tile_available: 'ফাঁকা আছে',
    details_tile_held: 'বর্তমানে সংরক্ষিত',
    details_tile_confirmed: 'ভর্তি নিশ্চিত',
    details_big_available: 'আসন ফাঁকা আছে',
    details_big_available_sub: 'তাৎক্ষণিক সংরক্ষণের জন্য আসন অবশিষ্ট',
    details_one_seat_note: 'বিজ্ঞপ্তি: আপনি একই ক্লাসে একবারে কেবল একটি আসন সংরক্ষণ করতে পারবেন।',
    details_apply_btn: 'এই আসনের জন্য আবেদন করুন',
    details_class_full: 'বর্তমানে এই ক্লাসে কোনো আসন ফাঁকা নেই।',
    details_not_found_title: 'ক্লাসটি পাওয়া যায়নি',
    details_not_found_desc: 'অনুরোধকৃত ক্লাসটি খুঁজে পাওয়া যায়নি অথবা মুছে ফেলা হয়েছে।',

    // Page 4: Hold Application
    hold_title: 'আসন সংরক্ষণ',
    hold_subtitle: 'আবেদনের অবস্থা: {status}',
    status_held: 'সংরক্ষিত (HELD)',
    status_confirmed: 'নিশ্চিত (CONFIRMED)',
    status_expired: 'মেয়াদোত্তীর্ণ (EXPIRED)',
    status_cancelled: 'বাতিল (CANCELLED)',
    hold_time_left: 'বাকি সময়',
    hold_time_expired: 'মেয়াদ শেষ',
    hold_summary_title: 'আবেদনের বিবরণ',
    hold_class_name: 'ক্লাস ও শিফট',
    hold_student_id: 'শিক্ষার্থী আইডি',
    hold_started_at: 'আবেদনের সময়',
    hold_expires_at: 'মেয়াদ উত্তীর্ণের সময়',
    hold_confirmed_at: 'ভর্তি নিশ্চিতের সময়',
    hold_btn_pay: 'ভর্তি ফি প্রদান করুন',
    hold_btn_paying: 'পেমেন্ট হচ্ছে...',
    hold_btn_pay_disabled_expired: 'ভর্তি ফি প্রদান (মেয়াদ শেষ)',
    hold_btn_cancel: 'আবেদন বাতিল করুন',
    hold_btn_cancelling: 'বাতিল হচ্ছে...',
    hold_simulated_notice_title: 'সিমুলেটেড পেমেন্ট',
    hold_simulated_notice_desc:
      'এটি একটি সিমুলেটেড পেমেন্ট। বাটনে চাপ দিলে সঙ্গে সঙ্গে ভর্তি নিশ্চিত হবে, কোনো পেমেন্ট গেটওয়ের প্রয়োজন নেই।',
    hold_confirmed_banner_title: 'ভর্তি নিশ্চিত হয়েছে!',
    hold_confirmed_banner_desc:
      '{name} ক্লাসে আপনার ভর্তি সফলভাবে নিশ্চিত হয়েছে। ভবিষ্যতের জন্য আপনার শিক্ষার্থী আইডি সংরক্ষণ করুন।',
    hold_expired_banner_title: 'সংরক্ষণের মেয়াদ শেষ',
    hold_expired_banner_desc:
      'ফি জমা দেওয়ার নির্ধারিত সময় শেষ হয়ে গেছে। আসনটি পুনরায় সাধারণ পুলে ফেরত গেছে।',
    hold_cancelled_banner_title: 'সংরক্ষণ বাতিল হয়েছে',
    hold_cancelled_banner_desc:
      'আপনি এই আসন সংরক্ষণটি বাতিল করেছেন। আসনটি পুনরায় সাধারণ পুলে ফেরত গেছে।',
    hold_apply_again: 'অন্য ক্লাসে আবেদন করুন',
    hold_not_found_title: 'আবেদন খুঁজে পাওয়া যায়নি',
    hold_not_found_desc: 'অনুরোধকৃত আসন সংরক্ষণটি বিদ্যমান নেই বা এর মেয়াদ শেষ হয়ে গেছে।',

    // Page 5: My Applications
    my_apps_title: 'আমার আবেদনসমূহ',
    my_apps_subtitle: 'আপনার সকল আসন সংরক্ষণ ও নিশ্চিতকরণের বিবরণ দেখুন',
    my_apps_empty_title: 'কোনো আবেদন পাওয়া যায়নি',
    my_apps_empty_desc: 'আপনি এখনও কোনো ক্লাসে আবেদন করেননি। শুরু করতে পছন্দের ক্লাস বেছে নিন।',
    my_apps_btn_apply_now: 'ক্লাসসমূহ দেখুন',
    my_apps_th_class: 'ক্লাস ও শিফট',
    my_apps_th_status: 'অবস্থা',
    my_apps_th_timeline: 'সময়ক্রম',
    my_apps_th_action: 'পদক্ষেপ',
    my_apps_held_time_left: '{time} বাকি',
    my_apps_paid_on: 'পরিশোধিত: {time}',
    my_apps_expired_desc: 'আসন ফেরত গেছে',
    my_apps_cancelled_desc: 'আবেদনকারী কর্তৃক বাতিল',
    my_apps_btn_view: 'বিস্তারিত',
    my_apps_btn_pay: 'ফি দিন',
    my_apps_btn_cancel: 'বাতিল',

    // Page 6: Admin Dashboard
    admin_dashboard_title: 'এডমিন ড্যাশবোর্ড',
    admin_dashboard_subtitle: 'রিয়েল-টাইম ভর্তি পরিসংখ্যান ও আসন পূরণ সংক্রান্ত তথ্য',
    admin_tile_total_classes: 'মোট ক্লাস শিফট',
    admin_tile_total_seats: 'মোট আসন',
    admin_tile_held_seats: 'সংরক্ষিত আসন',
    admin_tile_confirmed_seats: 'নিশ্চিত আসন',
    admin_seats_by_class: 'ক্লাস শিফট অনুযায়ী আসন',
    admin_seats_by_class_desc: 'সকল শিফটের আসন পূরণের বিস্তারিত চিত্র',
    admin_no_classes_yet: 'এখনও কোনো ক্লাস তৈরি করা হয়নি।',
    admin_btn_create_first: 'প্রথম ক্লাস তৈরি করুন',

    // Page 7: Manage Classes
    manage_classes_title: 'ক্লাস পরিচালনা',
    manage_classes_subtitle: 'আসন বণ্টন পর্যবেক্ষণ, অনুসন্ধান ও আসন ক্ষমতা পরিবর্তন',
    manage_search_placeholder: 'নাম বা শিফট দিয়ে ক্লাস খুঁজুন...',
    manage_btn_new_class: 'নতুন ক্লাস তৈরি করুন',
    manage_th_class_name: 'ক্লাস ও শিফট',
    manage_th_total: 'মোট',
    manage_th_held: 'সংরক্ষিত',
    manage_th_confirmed: 'নিশ্চিত',
    manage_th_available: 'ফাঁকা',
    manage_th_occupancy: 'পূরণ হার',
    manage_th_actions: 'পদক্ষেপ',
    manage_btn_edit: 'সম্পাদনা',
    manage_no_search_results: 'অনুসন্ধানের সাথে কোনো ক্লাস মেলেনি।',

    // Page 8: Create / Edit Class
    form_create_title: 'নতুন ক্লাস তৈরি',
    form_edit_title: 'ক্লাস সম্পাদনা',
    form_create_subtitle: 'নতুন ক্লাস শিফট ও আসন সংখ্যা নির্ধারণ করুন',
    form_edit_subtitle: 'ক্লাসের নাম ও মোট আসন সংখ্যা আপডেট করুন',
    form_label_class: 'ক্লাসের নাম',
    form_placeholder_class: 'যেমন: ষষ্ঠ শ্রেণি',
    form_label_shift: 'শিফট',
    shift_morning: 'মর্নিং শিফট',
    shift_day: 'ডে শিফট',
    shift_evening: 'ইভনিং শিফট',
    shift_none: 'শিফট নেই',
    form_label_total_seats: 'মোট আসন সংখ্যা',
    form_seats_help: '১ থেকে ১০,০০০ এর মধ্যে হতে হবে।',
    form_preview_title: 'ক্লাসের প্রিভিউ',
    form_preview_subtitle: 'অভিভাবক ও শিক্ষার্থীরা যেভাবে দেখতে পাবেন',
    form_btn_create: 'ক্লাস তৈরি করুন',
    form_btn_update: 'সংরক্ষণ করুন',
    form_btn_submitting: 'সংরক্ষণ হচ্ছে...',
    form_btn_cancel: 'বাতিল',
    form_err_name_req: 'ক্লাসের নাম আবশ্যক।',
    form_err_seats_req: 'মোট আসন সংখ্যা অবশ্যই ১ থেকে ১০,০০০ এর মধ্যে হতে হবে।',
    form_err_seats_below_occupied:
      'মোট আসন সংখ্যা {count} এর নিচে কমানো যাবে না (বর্তমানে {held}টি সংরক্ষিত + {confirmed}টি নিশ্চিত)।',
    form_success_created: '"{name}" ক্লাসটি সফলভাবে তৈরি হয়েছে।',
    form_success_updated: '"{name}" ক্লাসটি সফলভাবে আপডেট হয়েছে।',

    // Common / Global
    loading: 'লোড হচ্ছে...',
    server_issue_title: 'সার্ভার সংযোগে সমস্যা',
    server_issue_msg: 'সার্ভারের সাথে সংযোগ স্থাপন করা যাচ্ছে না। স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করা হচ্ছে...',
  },
} as const;

export type TranslationKey = keyof (typeof TRANSLATIONS)['en'];

export function getTranslation(
  lang: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  let text: string = (dict as Record<string, string>)[key] || (TRANSLATIONS.en as Record<string, string>)[key] || key;

  if (params) {
    Object.entries(params).forEach(([paramKey, val]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
    });
  }
  return text;
}

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'bn' || saved === 'en') {
        return saved;
      }
    } catch {
      // localStorage unavailable / private mode
    }
    return 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch {
      // Ignore storage errors
    }
    window.dispatchEvent(new CustomEvent('language-changed', { detail: newLang }));
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'bn')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    return getTranslation(lang, key, params);
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful English fallback for tests or components rendered outside provider
    return {
      lang: 'en',
      setLang: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) =>
        getTranslation('en', key, params),
    };
  }
  return ctx;
}

