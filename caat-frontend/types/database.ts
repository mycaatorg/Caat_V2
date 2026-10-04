export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          id: string
          is_online: boolean
          location: string | null
          time_end: string | null
          time_start: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          id?: string
          is_online?: boolean
          location?: string | null
          time_end?: string | null
          time_start?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          is_online?: boolean
          location?: string | null
          time_end?: string | null
          time_start?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      community_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      community_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      community_group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_group_requests: {
        Row: {
          created_at: string
          group_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_group_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_groups: {
        Row: {
          banner_url: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_private: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_private?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_private?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          group_id: string | null
          id: string
          is_anonymous: boolean
          is_hidden: boolean
          major_id: string | null
          poll_options: Json | null
          result_card: Json | null
          resume_link: string | null
          score_card: Json | null
          topic_tag: string
          university_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          group_id?: string | null
          id?: string
          is_anonymous?: boolean
          is_hidden?: boolean
          major_id?: string | null
          poll_options?: Json | null
          result_card?: Json | null
          resume_link?: string | null
          score_card?: Json | null
          topic_tag: string
          university_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          group_id?: string | null
          id?: string
          is_anonymous?: boolean
          is_hidden?: boolean
          major_id?: string | null
          poll_options?: Json | null
          result_card?: Json | null
          resume_link?: string | null
          score_card?: Json | null
          topic_tag?: string
          university_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profile_settings: {
        Row: {
          pinned_post_id: string | null
          show_graduation_year: boolean
          show_preferred_countries: boolean
          show_school_name: boolean
          show_target_majors: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          pinned_post_id?: string | null
          show_graduation_year?: boolean
          show_preferred_countries?: boolean
          show_school_name?: boolean
          show_target_majors?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          pinned_post_id?: string | null
          show_graduation_year?: boolean
          show_preferred_countries?: boolean
          show_school_name?: boolean
          show_target_majors?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_profile_settings_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_essay_prompts: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          icon: string | null
          ordering: number | null
          section: string | null
          user_id: string
          widget_key: number | null
        }
        Insert: {
          icon?: string | null
          ordering?: number | null
          section?: string | null
          user_id: string
          widget_key?: number | null
        }
        Update: {
          icon?: string | null
          ordering?: number | null
          section?: string | null
          user_id?: string
          widget_key?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          review_notes: string | null
          school_id: number | null
          status: string
          storage_path: string
          updated_at: string | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          review_notes?: string | null
          school_id?: number | null
          status?: string
          storage_path: string
          updated_at?: string | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          review_notes?: string | null
          school_id?: number | null
          status?: string
          storage_path?: string
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_drafts: {
        Row: {
          content: string
          content_json: Json | null
          created_at: string
          id: string
          is_current: boolean
          label: string | null
          prompt_id: string
          prompt_slug: string
          school_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          is_current?: boolean
          label?: string | null
          prompt_id: string
          prompt_slug: string
          school_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          is_current?: boolean
          label?: string | null
          prompt_id?: string
          prompt_slug?: string
          school_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_drafts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_prompts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          scope: string
          slug: string
          sort_order: number
          tips: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          scope?: string
          slug: string
          sort_order?: number
          tips?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          scope?: string
          slug?: string
          sort_order?: number
          tips?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      majors: {
        Row: {
          career_paths: Json | null
          category: string
          created_at: string
          degree_lengths: Json | null
          description: string | null
          id: string
          name: string
          qs_ranking_url: string | null
          typical_coursework: Json | null
        }
        Insert: {
          career_paths?: Json | null
          category: string
          created_at?: string
          degree_lengths?: Json | null
          description?: string | null
          id?: string
          name: string
          qs_ranking_url?: string | null
          typical_coursework?: Json | null
        }
        Update: {
          career_paths?: Json | null
          category?: string
          created_at?: string
          degree_lengths?: Json | null
          description?: string | null
          id?: string
          name?: string
          qs_ranking_url?: string | null
          typical_coursework?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          post_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "community_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activities: string[] | null
          avatar_url: string | null
          birth_date: string | null
          current_location: string | null
          curriculum: string | null
          default_resume_id: string | null
          email: string | null
          first_name: string | null
          github: string | null
          graduation_year: number | null
          id: string
          is_verified: boolean
          last_name: string | null
          linkedin: string | null
          nationality: string | null
          phone: string | null
          preferred_countries: string[] | null
          school_name: string | null
          target_majors: string[] | null
          updated_at: string | null
        }
        Insert: {
          activities?: string[] | null
          avatar_url?: string | null
          birth_date?: string | null
          current_location?: string | null
          curriculum?: string | null
          default_resume_id?: string | null
          email?: string | null
          first_name?: string | null
          github?: string | null
          graduation_year?: number | null
          id: string
          is_verified?: boolean
          last_name?: string | null
          linkedin?: string | null
          nationality?: string | null
          phone?: string | null
          preferred_countries?: string[] | null
          school_name?: string | null
          target_majors?: string[] | null
          updated_at?: string | null
        }
        Update: {
          activities?: string[] | null
          avatar_url?: string | null
          birth_date?: string | null
          current_location?: string | null
          curriculum?: string | null
          default_resume_id?: string | null
          email?: string | null
          first_name?: string | null
          github?: string | null
          graduation_year?: number | null
          id?: string
          is_verified?: boolean
          last_name?: string | null
          linkedin?: string | null
          nationality?: string | null
          phone?: string | null
          preferred_countries?: string[] | null
          school_name?: string | null
          target_majors?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_resume_id_fkey"
            columns: ["default_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_sections: {
        Row: {
          content_html: string
          created_at: string
          id: string
          label: string
          mode: string
          resume_id: string
          section_key: string
          sort_order: number
          structured_data: Json | null
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          label: string
          mode?: string
          resume_id: string
          section_key: string
          sort_order?: number
          structured_data?: Json | null
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          label?: string
          mode?: string
          resume_id?: string
          section_key?: string
          sort_order?: number
          structured_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_sections_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          id: string
          template: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_import_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          records_inserted: number
          records_seen: number
          records_updated: number
          source_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          records_inserted?: number
          records_seen?: number
          records_updated?: number
          source_id?: string | null
          started_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          records_inserted?: number
          records_seen?: number
          records_updated?: number
          source_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_import_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scholarship_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_majors: {
        Row: {
          created_at: string
          major_id: string
          scholarship_id: string
        }
        Insert: {
          created_at?: string
          major_id: string
          scholarship_id: string
        }
        Update: {
          created_at?: string
          major_id?: string
          scholarship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_majors_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_majors_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_schools: {
        Row: {
          created_at: string
          scholarship_id: string
          school_id: number
        }
        Insert: {
          created_at?: string
          scholarship_id: string
          school_id: number
        }
        Update: {
          created_at?: string
          scholarship_id?: string
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_schools_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_sources: {
        Row: {
          api_url: string | null
          base_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          source_type: string
          updated_at: string
        }
        Insert: {
          api_url?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          source_type: string
          updated_at?: string
        }
        Update: {
          api_url?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      scholarships: {
        Row: {
          amount_currency: string | null
          amount_display: string | null
          amount_value: number | null
          application_open_at: string | null
          application_requirements: Json | null
          awards_count: number | null
          citizenships: Json | null
          contact_info: Json | null
          country: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          eligibility_summary: string | null
          eligible_countries: string[]
          eligible_genders: string[]
          excluded_countries: string[]
          external_id: string | null
          external_url: string | null
          field_of_study: string[] | null
          frequency: string | null
          funding_type: string[]
          id: string
          is_active: boolean
          is_featured: boolean
          is_recurring: boolean
          last_verified_at: string | null
          merit_based: boolean | null
          minimum_gpa: number | null
          need_based: boolean | null
          provider_name: string
          raw_payload: Json | null
          requires_essay: boolean | null
          school_name: string | null
          slug: string | null
          source_id: string | null
          source_last_synced_at: string | null
          start_term: string | null
          state_region: string | null
          study_level: string[]
          tags: string[]
          title: string
          updated_at: string
          year_level: string[] | null
        }
        Insert: {
          amount_currency?: string | null
          amount_display?: string | null
          amount_value?: number | null
          application_open_at?: string | null
          application_requirements?: Json | null
          awards_count?: number | null
          citizenships?: Json | null
          contact_info?: Json | null
          country?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          eligibility_summary?: string | null
          eligible_countries?: string[]
          eligible_genders?: string[]
          excluded_countries?: string[]
          external_id?: string | null
          external_url?: string | null
          field_of_study?: string[] | null
          frequency?: string | null
          funding_type?: string[]
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_recurring?: boolean
          last_verified_at?: string | null
          merit_based?: boolean | null
          minimum_gpa?: number | null
          need_based?: boolean | null
          provider_name: string
          raw_payload?: Json | null
          requires_essay?: boolean | null
          school_name?: string | null
          slug?: string | null
          source_id?: string | null
          source_last_synced_at?: string | null
          start_term?: string | null
          state_region?: string | null
          study_level?: string[]
          tags?: string[]
          title: string
          updated_at?: string
          year_level?: string[] | null
        }
        Update: {
          amount_currency?: string | null
          amount_display?: string | null
          amount_value?: number | null
          application_open_at?: string | null
          application_requirements?: Json | null
          awards_count?: number | null
          citizenships?: Json | null
          contact_info?: Json | null
          country?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          eligibility_summary?: string | null
          eligible_countries?: string[]
          eligible_genders?: string[]
          excluded_countries?: string[]
          external_id?: string | null
          external_url?: string | null
          field_of_study?: string[] | null
          frequency?: string | null
          funding_type?: string[]
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_recurring?: boolean
          last_verified_at?: string | null
          merit_based?: boolean | null
          minimum_gpa?: number | null
          need_based?: boolean | null
          provider_name?: string
          raw_payload?: Json | null
          requires_essay?: boolean | null
          school_name?: string | null
          slug?: string | null
          source_id?: string | null
          source_last_synced_at?: string | null
          start_term?: string | null
          state_region?: string | null
          study_level?: string[]
          tags?: string[]
          title?: string
          updated_at?: string
          year_level?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scholarship_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      school_majors: {
        Row: {
          major_id: string
          school_id: number
        }
        Insert: {
          major_id: string
          school_id: number
        }
        Update: {
          major_id?: string
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_majors_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_majors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          country: string | null
          created_at: string
          id: number
          institution_type: string | null
          name: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: number
          institution_type?: string | null
          name: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: number
          institution_type?: string | null
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      standardised_test_scores: {
        Row: {
          created_at: string | null
          cumulative_score: string | null
          curriculum: string
          id: string
          profile_id: string
          score_scale: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cumulative_score?: string | null
          curriculum: string
          id?: string
          profile_id: string
          score_scale?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cumulative_score?: string | null
          curriculum?: string
          id?: string
          profile_id?: string
          score_scale?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standardised_test_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      standardised_test_subjects: {
        Row: {
          created_at: string | null
          grade: string
          id: string
          subject_name: string
          test_score_id: string
        }
        Insert: {
          created_at?: string | null
          grade: string
          id?: string
          subject_name: string
          test_score_id: string
        }
        Update: {
          created_at?: string | null
          grade?: string
          id?: string
          subject_name?: string
          test_score_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standardised_test_subjects_test_score_id_fkey"
            columns: ["test_score_id"]
            isOneToOne: false
            referencedRelation: "standardised_test_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookmarked_majors: {
        Row: {
          created_at: string
          major_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          major_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          major_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bookmarked_majors_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookmarked_scholarships: {
        Row: {
          created_at: string
          scholarship_id: string
          school_id: number | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          scholarship_id: string
          school_id?: number | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          scholarship_id?: string
          school_id?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bookmarked_scholarships_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bookmarked_scholarships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bookmarked_schools: {
        Row: {
          created_at: string
          school_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          school_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          school_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bookmarked_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_widgets: {
        Row: {
          created_at: string
          grid_h: number | null
          grid_w: number | null
          grid_x: number | null
          grid_y: number | null
          id: string
          order: number
          user_id: string
          widget_id: string
        }
        Insert: {
          created_at?: string
          grid_h?: number | null
          grid_w?: number | null
          grid_x?: number | null
          grid_y?: number | null
          id?: string
          order?: number
          user_id: string
          widget_id: string
        }
        Update: {
          created_at?: string
          grid_h?: number | null
          grid_w?: number | null
          grid_x?: number | null
          grid_y?: number | null
          id?: string
          order?: number
          user_id?: string
          widget_id?: string
        }
        Relationships: []
      }
      user_recommenders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          notes: string | null
          status: string
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_scholarships: {
        Row: {
          amount_currency: string
          amount_display: string | null
          amount_value: number | null
          awards_count: number | null
          country: string | null
          created_at: string
          deadline_at: string | null
          description: string | null
          eligible_countries: string[]
          external_url: string | null
          frequency: string | null
          funding_type: string[]
          id: string
          notes: string | null
          provider_name: string
          school_id: number | null
          status: string
          study_level: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_currency?: string
          amount_display?: string | null
          amount_value?: number | null
          awards_count?: number | null
          country?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          eligible_countries?: string[]
          external_url?: string | null
          frequency?: string | null
          funding_type?: string[]
          id?: string
          notes?: string | null
          provider_name: string
          school_id?: number | null
          status?: string
          study_level?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_currency?: string
          amount_display?: string | null
          amount_value?: number | null
          awards_count?: number | null
          country?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          eligible_countries?: string[]
          external_url?: string | null
          frequency?: string | null
          funding_type?: string[]
          id?: string
          notes?: string | null
          provider_name?: string
          school_id?: number | null
          status?: string
          study_level?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scholarships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_school_applications: {
        Row: {
          created_at: string | null
          deadline_at: string | null
          id: string
          intended_majors: string[]
          notes: string | null
          school_id: number
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deadline_at?: string | null
          id?: string
          intended_majors?: string[]
          notes?: string | null
          school_id: number
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deadline_at?: string | null
          id?: string
          intended_majors?: string[]
          notes?: string | null
          school_id?: number
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_school_applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_school_notes: {
        Row: {
          notes: string
          school_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          notes?: string
          school_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          notes?: string
          school_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_school_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_todos: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          priority: number
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: number
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: number
          text?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_group_join_request: {
        Args: { p_group_id: string; p_requester_user_id: string }
        Returns: boolean
      }
      can_access_community_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      can_read_community_comment: {
        Args: { p_comment_id: string }
        Returns: boolean
      }
      can_read_community_post: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      can_request_community_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      can_write_community_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      delete_own_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_community_profile_extended: {
        Args: { target_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          graduation_year: number
          id: string
          last_name: string
          preferred_countries: string[]
          school_name: string
          target_majors: string[]
        }[]
      }
      get_poll_vote_counts: {
        Args: { post_ids: string[] }
        Returns: {
          option_id: string
          post_id: string
          votes: number
        }[]
      }
      get_public_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          first_name: string
          id: string
          is_verified: boolean
          last_name: string
        }[]
      }
      reject_group_join_request: {
        Args: { p_group_id: string; p_requester_user_id: string }
        Returns: boolean
      }
      scholarship_universities: { Args: never; Returns: string[] }
      search_scholarships: {
        Args: {
          p_citizenship?: string[]
          p_domestic_codes?: string[]
          p_fields?: string[]
          p_funding?: string[]
          p_grad_year?: number
          p_home_country?: string
          p_levels?: string[]
          p_limit?: number
          p_location?: string
          p_offset?: number
          p_open_only?: boolean
          p_pref_countries?: string[]
          p_restrict_ids?: string[]
          p_search?: string
          p_target_majors?: string[]
          p_universities?: string[]
        }
        Returns: {
          data: Json
          total_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
