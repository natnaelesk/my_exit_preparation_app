from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """100 per page by default; clients that need a full list request bigger pages and follow `next`."""
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000
