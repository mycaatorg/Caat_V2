export type WidgetType =
  | "list-todo"
  | "university"
  | "calendar"
  | "news";

export type WidgetSection = "main" | "active" | "hidden";


/**
 * What the builder shell will keep in state.
 * (Same as WidgetSection but with sortOrder because db needs it)
 */
export type WidgetSectionPosition = WidgetSection & {
        sortOrder: number;
};

/**
 * Full widget state what you load into the page).
 */
export type WidgetState = {
        widgetId: string;
        sections: WidgetSectionPosition[];
};

export type SaveWidgetPayload = {
        widgetId: string;
        sections: Array<{
                id: string;
                icon: WidgetType;
                section: WidgetSection;
                sortOrder: number;
        }>;
};